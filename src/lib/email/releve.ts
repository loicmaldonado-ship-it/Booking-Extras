import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjetEmailCredentials } from "@/lib/projets/email";

// Relève automatique des réponses par mail : chaque projet est relu dans SA
// boîte d'envoi (celle configurée par la cheffe sur le projet ou sur
// Équipe ; la boîte partagée du site seulement pour le compte propriétaire
// sans boîte à lui). Le site retient le dernier mail lu par boîte (UID
// IMAP) et ne marque jamais rien comme lu dans Gmail.

const PREMIERE_RELEVE_JOURS = 3;
const MAX_PAR_PASSAGE = 200;

type Boite = { user: string; pass: string; projetIds: string[] };

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Garde seulement le nouveau texte d'une réponse : coupe la citation du
// message d'origine (« Le … a écrit : », « On … wrote: », lignes « > »).
export function texteDeLaReponse(texte: string): string {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const sortie: string[] = [];
  for (const ligne of lignes) {
    const l = ligne.trim();
    if (/^(le |on ).{0,200}(a écrit|a ecrit|wrote)\s*:?\s*$/i.test(l)) break;
    if (/^-{2,}\s*(message d'origine|original message|forwarded message)/i.test(l)) break;
    if (/^de\s*:|^from\s*:/i.test(l) && sortie.length > 0) break;
    if (l.startsWith(">")) continue;
    sortie.push(ligne);
  }
  const propre = sortie.join("\n").trim();
  return propre || texte.trim();
}

// Boîtes à relever : une par adresse d'envoi, avec les projets qui
// envoient depuis elle (projets non archivés).
async function boitesARelever(seulementProjetId?: string): Promise<Boite[]> {
  const supabase = createAdminClient();
  let q = supabase.from("projets").select("id").eq("archive", false);
  if (seulementProjetId) q = q.eq("id", seulementProjetId);
  const { data: projets } = await q;
  const parAdresse = new Map<string, Boite>();
  for (const p of projets ?? []) {
    const { credentials, error } = await getProjetEmailCredentials(supabase, p.id);
    // Cheffe sans boîte configurée : rien n'est parti de ce projet par mail.
    if (!credentials && error) continue;
    const user = credentials?.user ?? process.env.GMAIL_SMTP_USER ?? null;
    const pass = credentials?.pass ?? process.env.GMAIL_SMTP_APP_PASSWORD ?? null;
    if (!user || !pass) continue;
    const cle = user.toLowerCase();
    const b = parAdresse.get(cle) ?? { user, pass, projetIds: [] };
    b.projetIds.push(p.id);
    parAdresse.set(cle, b);
  }
  return Array.from(parAdresse.values());
}

export type ReleveResultat = { boite: string; nouvelles: number; erreur?: string };

async function releverBoite(boite: Boite): Promise<ReleveResultat> {
  const supabase = createAdminClient();
  const cle = boite.user.toLowerCase();

  // Profils joignables depuis cette boîte : ceux à qui un de ses projets a
  // écrit. Une réponse est rattachée au projet du dernier message envoyé.
  const { data: envoyes } = await supabase
    .from("figurant_messages")
    .select("figurant_id, projet_id, created_at, figurants(email)")
    .eq("sender", "staff")
    .in("projet_id", boite.projetIds)
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<{ figurant_id: string; projet_id: string; created_at: string; figurants: { email: string | null } | null }[]>();
  const parEmail = new Map<string, { figurantId: string; projetId: string }>();
  for (const m of envoyes ?? []) {
    const email = m.figurants?.email?.toLowerCase();
    if (email && !parEmail.has(email)) parEmail.set(email, { figurantId: m.figurant_id, projetId: m.projet_id });
  }

  const { data: etat } = await supabase.from("boites_mail_releve").select("uidvalidity, dernier_uid").eq("boite", cle).maybeSingle();

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: boite.user, pass: boite.pass },
    logger: false,
  });

  let nouvelles = 0;
  try {
    await client.connect();
    const boiteImap = await client.mailboxOpen("INBOX", { readOnly: true });
    const uidvalidity = Number(boiteImap.uidValidity);
    const reprise = etat && Number(etat.uidvalidity) === uidvalidity && etat.dernier_uid != null;

    let uids: number[] = [];
    if (reprise) {
      const res = await client.search({ uid: `${Number(etat!.dernier_uid) + 1}:*` }, { uid: true });
      uids = (res || []).filter((u) => u > Number(etat!.dernier_uid));
    } else {
      const depuis = new Date(Date.now() - PREMIERE_RELEVE_JOURS * 24 * 3600 * 1000);
      uids = (await client.search({ since: depuis }, { uid: true })) || [];
    }
    uids.sort((a, b) => a - b);
    uids = uids.slice(0, MAX_PAR_PASSAGE);

    let dernierUid = reprise ? Number(etat!.dernier_uid) : 0;
    for (const uid of uids) {
      dernierUid = Math.max(dernierUid, uid);
      try {
        const message = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
        const de = message ? message.envelope?.from?.[0]?.address?.toLowerCase() : undefined;
        const cible = de ? parEmail.get(de) : undefined;
        if (!message || !cible) continue;

        const messageId = message.envelope?.messageId ?? `${cle}:${uidvalidity}:${uid}`;
        const { data: deja } = await supabase.from("figurant_messages").select("id").eq("mail_message_id", messageId).maybeSingle();
        if (deja) continue;

        const complet = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!complet || !complet.source) continue;
        const parsed = await simpleParser(complet.source, { skipHtmlToText: true });
        let corps = parsed.text?.trim() || "";
        if (!corps && parsed.html) corps = stripHtml(String(parsed.html));
        corps = texteDeLaReponse(corps).slice(0, 3000) || "(message vide)";

        // Déjà importée par l'ancien bouton « Vérifier les réponses » (sans
        // identifiant de mail) : même personne, même texte, moins de 7 jours.
        const { data: doublon } = await supabase
          .from("figurant_messages")
          .select("id")
          .eq("figurant_id", cible.figurantId)
          .eq("sender", "figurant")
          .eq("corps", corps)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (doublon) continue;

        const { error } = await supabase.from("figurant_messages").insert({
          figurant_id: cible.figurantId,
          sender: "figurant",
          corps,
          sujet: message.envelope?.subject?.trim() || null,
          categorie: "libre",
          projet_id: cible.projetId,
          mail_message_id: messageId,
          created_at: (message.envelope?.date ?? new Date()).toISOString(),
        });
        if (!error) nouvelles += 1;
      } catch {
        // Mail illisible : ignoré, la relève continue.
      }
    }

    await supabase.from("boites_mail_releve").upsert({
      boite: cle,
      uidvalidity,
      dernier_uid: uids.length > 0 ? dernierUid : reprise ? Number(etat!.dernier_uid) : Number(boiteImap.uidNext) - 1,
      releve_le: new Date().toISOString(),
      erreur: null,
    });
    return { boite: cle, nouvelles };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : "Connexion à la boîte impossible.";
    await supabase.from("boites_mail_releve").upsert({ boite: cle, releve_le: new Date().toISOString(), erreur });
    return { boite: cle, nouvelles, erreur };
  } finally {
    try {
      await client.logout();
    } catch {
      // Déjà déconnecté.
    }
  }
}

// Toutes les boîtes (tâche planifiée), ou seulement celle d'un projet.
export async function releverReponsesMail(seulementProjetId?: string): Promise<ReleveResultat[]> {
  // En local, le .env pointe vers de vraies boîtes Gmail : pas de relève
  // sauf demande explicite (RELEVE_MAILS_LOCAL=1).
  if (process.env.NODE_ENV !== "production" && !process.env.RELEVE_MAILS_LOCAL) {
    return [{ boite: "local", nouvelles: 0, erreur: "relève désactivée en local" }];
  }
  const boites = await boitesARelever(seulementProjetId);
  const resultats: ReleveResultat[] = [];
  for (const b of boites) resultats.push(await releverBoite(b));
  return resultats;
}

// Dernière relève de la boîte d'un projet (affichage « relevé il y a… »).
export async function derniereReleveProjet(projetId: string): Promise<{ le: string | null; erreur: string | null }> {
  const supabase = createAdminClient();
  const { credentials } = await getProjetEmailCredentials(supabase, projetId);
  const user = (credentials?.user ?? process.env.GMAIL_SMTP_USER ?? "").toLowerCase();
  if (!user) return { le: null, erreur: null };
  const { data } = await supabase.from("boites_mail_releve").select("releve_le, erreur").eq("boite", user).maybeSingle();
  return { le: data?.releve_le ?? null, erreur: data?.erreur ?? null };
}

// « Marquer comme lu dans Gmail » : une fois la réponse traitée dans
// l'appli, le mail correspondant passe en lu dans la boîte du projet.
export async function marquerMailLu(messageRowId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { data: m } = await supabase
    .from("figurant_messages")
    .select("mail_message_id, projet_id")
    .eq("id", messageRowId)
    .maybeSingle();
  if (!m?.mail_message_id || !m.projet_id) return { error: "Ce message ne vient pas d'une boîte mail." };
  if (process.env.NODE_ENV !== "production" && !process.env.RELEVE_MAILS_LOCAL) {
    return { error: "Désactivé en local." };
  }
  const { credentials, error } = await getProjetEmailCredentials(supabase, m.projet_id);
  if (!credentials && error) return { error };
  const user = credentials?.user ?? process.env.GMAIL_SMTP_USER;
  const pass = credentials?.pass ?? process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) return { error: "Boîte mail du projet non configurée." };

  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    const uids = (await client.search({ header: { "message-id": m.mail_message_id } }, { uid: true })) || [];
    if (uids.length === 0) return { error: "Mail introuvable dans la boîte (déplacé ou supprimé ?)." };
    await client.messageFlagsAdd(uids.join(","), ["\\Seen"], { uid: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connexion à la boîte impossible." };
  } finally {
    try {
      await client.logout();
    } catch {
      // Déjà déconnecté.
    }
  }
  await supabase.from("figurant_messages").update({ lu_gmail_le: new Date().toISOString() }).eq("id", messageRowId);
  return {};
}
