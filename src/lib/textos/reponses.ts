import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { telephoneInternational } from "@/lib/textos/telephone";

const JOURS_ENVOIS = 30;
const JOURS_BOOKINGS = 60;

export type NumeroSuivi = { figurantId: string; projetId: string };

// Numéros dont le relais Mac doit remonter les réponses : les personnes à
// qui cette personne de l'équipe a écrit récemment (envois texto suivis, ou
// profils bookés sur ses projets). Rien d'autre n'est lu ni envoyé au site.
export async function numerosSuivis(profileId: string): Promise<Map<string, NumeroSuivi>> {
  const supabase = createAdminClient();
  const suivis = new Map<string, NumeroSuivi>();
  const depuisEnvois = new Date(Date.now() - JOURS_ENVOIS * 24 * 3600 * 1000).toISOString();

  // 1. Envois texto suivis (onglet Messages) faits par cette personne.
  const { data: envois } = await supabase
    .from("envois")
    .select("projet_id, created_at, envoi_destinataires(figurant_id, figurants(telephone))")
    .eq("created_by", profileId)
    .eq("canal", "texto")
    .gte("created_at", depuisEnvois)
    .order("created_at", { ascending: false })
    .returns<{ projet_id: string; created_at: string; envoi_destinataires: { figurant_id: string; figurants: { telephone: string | null } | null }[] }[]>();
  for (const e of envois ?? []) {
    for (const d of e.envoi_destinataires ?? []) {
      const tel = telephoneInternational(d.figurants?.telephone ?? null);
      if (tel && !suivis.has(tel)) suivis.set(tel, { figurantId: d.figurant_id, projetId: e.projet_id });
    }
  }

  // 2. Profils bookés récemment sur ses projets (textos de journée, casting…).
  const [{ data: possedes }, { data: membre }] = await Promise.all([
    supabase.from("projets").select("id").eq("owner_id", profileId).eq("archive", false),
    supabase.from("projet_membres").select("projet_id").eq("profile_id", profileId),
  ]);
  const projetIds = Array.from(new Set([...(possedes ?? []).map((p) => p.id), ...(membre ?? []).map((m) => m.projet_id)]));
  if (projetIds.length === 0) return suivis;

  const depuisBookings = new Date(Date.now() - JOURS_BOOKINGS * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: bookings } = await fetchAll<{ figurant_id: string; projet_id: string; date: string; figurants: { telephone: string | null } | null }>(
    (from, to) =>
      supabase
        .from("bookings")
        .select("figurant_id, projet_id, date, figurants!bookings_figurant_id_fkey(telephone)")
        .in("projet_id", projetIds)
        .gte("date", depuisBookings)
        .order("date", { ascending: false })
        .range(from, to)
        .returns<{ figurant_id: string; projet_id: string; date: string; figurants: { telephone: string | null } | null }[]>()
  );
  for (const b of bookings) {
    const tel = telephoneInternational(b.figurants?.telephone ?? null);
    if (tel && !suivis.has(tel)) suivis.set(tel, { figurantId: b.figurant_id, projetId: b.projet_id });
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
