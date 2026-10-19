import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { telephoneInternational } from "@/lib/textos/telephone";

const JOURS_SUIVI = 30;

// Numéro suivi : la personne à qui on a écrit, le projet, et la date du
// dernier texto envoyé depuis l'appli (seules les réponses reçues après
// comptent).
export type NumeroSuivi = { figurantId: string; projetId: string | null; depuis: string };

// Numéros dont le relais Mac doit remonter les réponses : uniquement ceux à
// qui cette personne de l'équipe a envoyé un texto DEPUIS L'APPLI (onglet
// Messages, textos groupés via le Mac ou l'iPhone) ces 30 derniers jours.
// Jamais les numéros de l'équipe, ni un contact juste parce qu'il est booké
// (un échange perso avec lui ne regarde pas le projet).
export async function numerosSuivis(profileId: string): Promise<Map<string, NumeroSuivi>> {
  const supabase = createAdminClient();
  const suivis = new Map<string, NumeroSuivi>();
  const depuis = new Date(Date.now() - JOURS_SUIVI * 24 * 3600 * 1000).toISOString();
  const noter = (tel: string | null, s: NumeroSuivi) => {
    if (!tel) return;
    const avant = suivis.get(tel);
    if (!avant || s.depuis > avant.depuis) suivis.set(tel, s);
  };

  const [{ data: equipe }, { data: envois }, { data: file }] = await Promise.all([
    supabase.from("profiles").select("telephone").not("telephone", "is", null),
    // 1. Envois texto suivis (onglet Messages) faits par cette personne.
    supabase
      .from("envois")
      .select("projet_id, envoi_destinataires(figurant_id, envoye_le, figurants(telephone))")
      .eq("created_by", profileId)
      .eq("canal", "texto")
      .gte("created_at", depuis)
      .returns<
        {
          projet_id: string;
          envoi_destinataires: { figurant_id: string; envoye_le: string | null; figurants: { telephone: string | null } | null }[];
        }[]
      >(),
    // 2. Textos groupés envoyés (relais Mac ou raccourci iPhone).
    supabase
      .from("textos_file")
      .select("telephone, figurant_id, projet_id, envoye_le")
      .eq("profile_id", profileId)
      .eq("statut", "envoye")
      .gte("envoye_le", depuis),
  ]);

  for (const e of envois ?? []) {
    for (const d of e.envoi_destinataires ?? []) {
      if (!d.envoye_le) continue;
      noter(telephoneInternational(d.figurants?.telephone ?? null), { figurantId: d.figurant_id, projetId: e.projet_id, depuis: d.envoye_le });
    }
  }

  // Textos groupés sans fiche notée (envois d'avant ce suivi) : retrouvée
  // par le numéro parmi les profils bookés sur ses projets.
  const ficheParTel = new Map<string, { figurantId: string; projetId: string }>();
  if ((file ?? []).some((t) => !t.figurant_id)) {
    const [{ data: possedes }, { data: membre }] = await Promise.all([
      supabase.from("projets").select("id").eq("owner_id", profileId).eq("archive", false),
      supabase.from("projet_membres").select("projet_id").eq("profile_id", profileId),
    ]);
    const projetIds = Array.from(new Set([...(possedes ?? []).map((p) => p.id), ...(membre ?? []).map((m) => m.projet_id)]));
    if (projetIds.length > 0) {
      const { data: bookings } = await fetchAll<{ figurant_id: string; projet_id: string; figurants: { telephone: string | null } | null }>(
        (from, to) =>
          supabase
            .from("bookings")
            .select("figurant_id, projet_id, figurants!bookings_figurant_id_fkey(telephone)")
            .in("projet_id", projetIds)
            .gte("date", depuis.slice(0, 10))
            .order("date", { ascending: false })
            .range(from, to)
            .returns<{ figurant_id: string; projet_id: string; figurants: { telephone: string | null } | null }[]>()
      );
      for (const b of bookings) {
        const tel = telephoneInternational(b.figurants?.telephone ?? null);
        if (tel && !ficheParTel.has(tel)) ficheParTel.set(tel, { figurantId: b.figurant_id, projetId: b.projet_id });
      }
    }
  }
  for (const t of file ?? []) {
    const ancienne = t.figurant_id ? null : ficheParTel.get(t.telephone);
    const figurantId = t.figurant_id ?? ancienne?.figurantId;
    if (!figurantId || !t.envoye_le) continue;
    noter(t.telephone, { figurantId, projetId: t.projet_id ?? ancienne?.projetId ?? null, depuis: t.envoye_le });
  }

  for (const p of equipe ?? []) {
    const tel = telephoneInternational(p.telephone);
    if (tel) suivis.delete(tel);
  }
  return suivis;
}

export type ReponseTexto = { guid: string; tel: string; texte: string; date: string };

// Enregistre les réponses remontées par le relais (jamais deux fois la même :
// l'identifiant du message de l'app Messages sert de clé).
export async function enregistrerReponsesTextos(profileId: string, reponses: ReponseTexto[]): Promise<number> {
  if (reponses.length === 0) return 0;
  const supabase = createAdminClient();
  const suivis = await numerosSuivis(profileId);
  let nouvelles = 0;
  for (const r of reponses.slice(0, 200)) {
    const tel = telephoneInternational(r.tel);
    const cible = tel ? suivis.get(tel) : undefined;
    const texte = (r.texte ?? "").trim();
    if (!cible || !texte || !r.guid) continue;
    const date = new Date(r.date);
    // Seulement les réponses reçues après le texto envoyé depuis l'appli.
    if (!Number.isNaN(date.getTime()) && date.toISOString() < cible.depuis) continue;
    const { error } = await supabase.from("figurant_messages").insert({
      figurant_id: cible.figurantId,
      sender: "figurant",
      corps: texte.slice(0, 3000),
      sujet: "Texto",
      categorie: "libre",
      projet_id: cible.projetId,
      mail_message_id: `sms:${r.guid}`,
      created_at: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    });
    if (!error) nouvelles += 1;
  }
  return nouvelles;
}
