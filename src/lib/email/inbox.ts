import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
