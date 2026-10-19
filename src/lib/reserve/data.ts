import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeAge } from "@/lib/documents/fields";
import { getPhotosByFigurantId, getPhotosParCandidature, pickPortrait } from "@/lib/documents/data";
import { nomComplet, trierParNom } from "@/lib/noms";

export type ReserveProfil = {
  id: string;
  figurantId: string;
  nom: string;
  age: number | null;
  ville: string | null;
  portraitUrl: string | null;
  miseLe: string;
  // Candidature d'origine : où il a postulé et quand (null = ajouté sans
  // candidature).
  candidatureId: string | null;
  annonceTitre: string | null;
  postuleLe: string | null;
  // Les dates de l'annonce, avec la dispo indiquée (null = pas de réponse).
  dispos: { date: string; disponible: boolean | null }[];
};

// Profils de la réserve d'un projet, avec où ils ont postulé et leurs dispos.
export async function getReserve(projetId: string): Promise<ReserveProfil[]> {
  const supabase = createAdminClient();
  const { data: lignes } = await supabase
    .from("reserve_profils")
    .select("id, figurant_id, candidature_id, created_at, figurants(prenom, nom, date_naissance, ville)")
    .eq("projet_id", projetId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        figurant_id: string;
        candidature_id: string | null;
        created_at: string;
        figurants: { prenom: string; nom: string; date_naissance: string | null; ville: string | null } | null;
      }[]
    >();
  const reserve = (lignes ?? []).filter((l) => l.figurants);
  if (reserve.length === 0) return [];

  const candidatureIds = reserve.map((l) => l.candidature_id).filter((id): id is string => !!id);
  const { data: candidatures } = candidatureIds.length
    ? await supabase
        .from("candidatures")
        .select("id, created_at, annonce_id, annonces(titre)")
        .in("id", candidatureIds)
        .returns<{ id: string; created_at: string; annonce_id: string; annonces: { titre: string } | null }[]>()
    : { data: [] as { id: string; created_at: string; annonce_id: string; annonces: { titre: string } | null }[] };
  const candidatureParId = new Map((candidatures ?? []).map((c) => [c.id, c]));
  const annonceIds = Array.from(new Set((candidatures ?? []).map((c) => c.annonce_id)));

  const [{ data: dates }, { data: dispos }, photosFigurant, photosCandidature] = await Promise.all([
    annonceIds.length
      ? supabase.from("annonce_dates").select("id, annonce_id, date").in("annonce_id", annonceIds).order("date")
      : Promise.resolve({ data: [] as { id: string; annonce_id: string; date: string }[] }),
    candidatureIds.length
      ? fetchAll((from, to) =>
          supabase
            .from("candidature_disponibilites")
            .select("candidature_id, annonce_date_id, disponible")
            .in("candidature_id", candidatureIds)
            .order("candidature_id")
            .order("annonce_date_id")
            .range(from, to)
            .returns<{ candidature_id: string; annonce_date_id: string; disponible: boolean }[]>()
        )
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string; disponible: boolean }[] }),
    getPhotosByFigurantId(reserve.map((l) => l.figurant_id)),
    getPhotosParCandidature(candidatureIds),
  ]);

  const datesParAnnonce = new Map<string, { id: string; date: string }[]>();
  for (const d of dates ?? []) datesParAnnonce.set(d.annonce_id, [...(datesParAnnonce.get(d.annonce_id) ?? []), d]);
  const dispoParCle = new Map((dispos ?? []).map((d) => [`${d.candidature_id}|${d.annonce_date_id}`, d.disponible]));

  return trierParNom(reserve, (l) => l.figurants).map((l): ReserveProfil => {
      const c = l.candidature_id ? candidatureParId.get(l.candidature_id) : undefined;
      const photos = (l.candidature_id ? photosCandidature.get(l.candidature_id) : undefined) ?? photosFigurant.get(l.figurant_id);
      return {
        id: l.id,
        figurantId: l.figurant_id,
        nom: nomComplet(l.figurants),
        age: computeAge(l.figurants!.date_naissance),
        ville: l.figurants!.ville,
        portraitUrl: pickPortrait(photos, projetId)?.url ?? null,
        miseLe: l.created_at,
        candidatureId: c?.id ?? null,
        annonceTitre: c?.annonces?.titre ?? null,
        postuleLe: c?.created_at ?? null,
        dispos: c
          ? (datesParAnnonce.get(c.annonce_id) ?? []).map((d) => ({
              date: d.date,
              disponible: dispoParCle.get(`${c.id}|${d.id}`) ?? null,
            }))
          : [],
      };
  });
}
