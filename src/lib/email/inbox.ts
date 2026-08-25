import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Heuristique par mots-clés uniquement — un simple indice affiché à l'écran,
// jamais utilisé pour changer automatiquement un statut de booking.
const POSITIVE_WORDS = [
  "oui",
  "ok",
  "d'accord",
  "daccord",
  "present",
  "presente",
  "je viens",
  "confirme",
  "dispo",
  "disponible",
  "ca marche",
  "parfait",
  "banco",
  "avec plaisir",
];
const NEGATIVE_WORDS = [
  "non",
  "indispo",
  "indisponible",
  "empech",
  "annule",
  "impossible",
  "pas possible",
  "desole",
  "ne peux pas",
  "ne pourrai pas",
];

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type Sentiment = "positif" | "negatif" | null;

export function guessSentiment(text: string): Sentiment {
  const n = normalize(text);
  const hasPositive = POSITIVE_WORDS.some((w) => n.includes(w));
  const hasNegative = NEGATIVE_WORDS.some((w) => n.includes(w));
  if (hasNegative && !hasPositive) return "negatif";
  if (hasPositive && !hasNegative) return "positif";
  return null;
}

// Rattache une réponse entrante au projet du dernier message STAFF envoyé à
// ce figurant — un figurant ne choisit pas de projet en répondant, donc on
// hérite du fil auquel il répond, pour que la réponse reste cloisonnée côté
// staff comme le reste de la messagerie (voir /figurants/[id]).
export async function inferReplyProjetId(
  supabase: ReturnType<typeof createAdminClient>,
  figurantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("figurant_messages")
    .select("projet_id")
    .eq("figurant_id", figurantId)
    .eq("sender", "staff")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.projet_id ?? null;
}

export type InboxReply = {
  messageId: string;
  figurantId: string;
  prenom: string;
  nom: string;
  email: string;
  sujet: string | null;
  corps: string;
  sentiment: Sentiment;
};

// Toutes les réponses de figurants pas encore "effacées" (reviewed_at nul) —
// s'accumulent au fil des vérifications successives jusqu'à ce qu'on les
// efface explicitement via clearUnreviewedReplies().
export async function getUnreviewedReplies(projetId?: string | null): Promise<InboxReply[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("figurant_messages")
    .select("id, corps, sujet, figurant_id, figurants(id, prenom, nom, email)")
    .eq("sender", "figurant")
    .is("reviewed_at", null);
  // Une réponse sans projet (héritage impossible, ex. mail hors-sujet capté
  // par l'IMAP) reste visible partout plutôt que de disparaître ; sinon on
  // ne montre que celles héritées du projet actuellement consulté.
  if (projetId) query = query.or(`projet_id.is.null,projet_id.eq.${projetId}`);
  const { data } = await query
    .order("created_at", { ascending: false })
    .returns<
      { id: string; corps: string; sujet: string | null; figurant_id: string; figurants: { id: string; prenom: string; nom: string; email: string | null } | null }[]
    >();

  return (data ?? [])
    .filter((m) => m.figurants)
    .map((m) => ({
      messageId: m.id,
      figurantId: m.figurant_id,
      prenom: m.figurants!.prenom,
      nom: m.figurants!.nom,
      email: m.figurants!.email ?? "",
      sujet: m.sujet,
      corps: m.corps,
      sentiment: guessSentiment(m.corps),
    }));
}

export async function clearUnreviewedReplies() {
  const supabase = createAdminClient();
  await supabase
    .from("figurant_messages")
    .update({ reviewed_at: new Date().toISOString() })
    .eq("sender", "figurant")
    .is("reviewed_at", null);
}

export type CheckRepliesResult = {
  checked: number;
  matched: InboxReply[];
  unmatchedCount: number;
  error?: string;
};

// Ne lit que les mails non lus de la boîte partagée (IMAP \Seen), les
// rattache au figurant par adresse d'expéditeur, les enregistre dans la
// messagerie interne, puis les marque lus. Un mail qui échoue à être traité
// reste non lu pour être retenté au prochain passage.
export async function checkEmailReplies(): Promise<CheckRepliesResult> {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) {
    return { checked: 0, matched: [], unmatchedCount: 0, error: "Boîte mail non configurée." };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const matched: InboxReply[] = [];
  let checked = 0;
  let unmatchedCount = 0;

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const supabase = createAdminClient();
    const { data: figurants } = await supabase
      .from("figurants")
      .select("id, prenom, nom, email")
      .not("email", "is", null);
    const byEmail = new Map((figurants ?? []).filter((f) => f.email).map((f) => [f.email!.toLowerCase(), f]));

    const uids = await client.search({ seen: false }, { uid: true });
    for (const uid of uids || []) {
      checked += 1;
      try {
        const message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!message || !message.source) continue;

        const fromAddress = message.envelope?.from?.[0]?.address?.toLowerCase();
        const figurant = fromAddress ? byEmail.get(fromAddress) : undefined;

        if (!figurant) {
          unmatchedCount += 1;
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          continue;
        }

        const parsed = await simpleParser(message.source, { skipHtmlToText: true });
        let corps = parsed.text?.trim() || "";
        if (!corps && parsed.html) corps = stripHtml(String(parsed.html));
        corps = corps.slice(0, 3000) || "(message vide)";
        const sujet = message.envelope?.subject?.trim() || null;

        const projetId = await inferReplyProjetId(supabase, figurant.id);
        const { data: inserted } = await supabase
          .from("figurant_messages")
          .insert({
            figurant_id: figurant.id,
            sender: "figurant",
            corps,
            sujet,
            categorie: "libre",
            projet_id: projetId,
          })
          .select("id")
          .single();

        matched.push({
          messageId: inserted?.id ?? "",
          figurantId: figurant.id,
          prenom: figurant.prenom,
          nom: figurant.nom,
          email: figurant.email!,
          sujet,
          corps,
          sentiment: guessSentiment(corps),
        });

        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } catch {
        // Message ignoré, laissé non lu pour être retenté au prochain passage.
      }
    }
  } catch (error) {
    return {
      checked,
      matched,
      unmatchedCount,
      error: error instanceof Error ? error.message : "Erreur de connexion à la boîte mail.",
    };
  } finally {
    try {
      await client.logout();
    } catch {
      // Déjà déconnecté.
    }
  }

  return { checked, matched, unmatchedCount };
}
