import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhotosByFigurantId, getPhotosParCandidature, type ConfirmedBooking, type FigurantPhotoWithUrl } from "@/lib/documents/data";
import type { Figurant } from "@/lib/figurants/types";

// Trombis et fiches mensuration d'une sélection de candidatures (page
// Candidatures), avant tout booking. Chaque candidature est présentée comme
// une ligne de document : fonction et cachet assignés dans Candidatures,
// pas d'heure de convocation.
export async function getCandidaturesPourDocuments(annonceId: string, ids: Set<string> | null) {
  const supabase = createAdminClient();
  const { data: annonce } = await supabase
    .from("annonces")
    .select("id, titre, projet_id")
    .eq("id", annonceId)
    .maybeSingle<{ id: string; titre: string; projet_id: string }>();
  if (!annonce) return null;

  const lignes: { id: string; fonction_assignee: string | null; cachet_assigne: string | null; figurants: Figurant | null }[] = [];
  const idsListe = ids ? Array.from(ids) : null;
  // Par paquets : un .in() sur des centaines d'UUID dépasse la longueur
  // d'URL acceptée par PostgREST.
  for (let i = 0; i < (idsListe?.length ?? 1); i += 150) {
    let query = supabase
      .from("candidatures")
      .select("id, fonction_assignee, cachet_assigne, figurants(*)")
      .eq("annonce_id", annonceId);
    if (idsListe) query = query.in("id", idsListe.slice(i, i + 150));
    const { data } = await query.returns<typeof lignes>();
    lignes.push(...(data ?? []));
  }

  const items: ConfirmedBooking[] = lignes
    .filter((l): l is typeof l & { figurants: Figurant } => !!l.figurants)
    .map((l) => ({
      id: l.id,
      heure_convocation: null,
      fonction: l.fonction_assignee,
      cachet: l.cachet_assigne,
      figurant: l.figurants,
    }));

  // Jours où chaque personne s'est dite disponible, pour la fiche.
  const dispos: { candidature_id: string; annonce_dates: { date: string } | null }[] = [];
  for (let i = 0; i < items.length; i += 150) {
    const { data } = await supabase
      .from("candidature_disponibilites")
      .select("candidature_id, annonce_dates(date)")
      .eq("disponible", true)
      .in(
        "candidature_id",
        items.slice(i, i + 150).map((it) => it.id)
      )
      .returns<typeof dispos>();
    dispos.push(...(data ?? []));
  }
  const joursDispo = new Map<string, string[]>();
  for (const d of dispos) {
    if (!d.annonce_dates) continue;
    const liste = joursDispo.get(d.candidature_id) ?? [];
    liste.push(d.annonce_dates.date);
    joursDispo.set(d.candidature_id, liste.sort());
  }

  return { annonce, items, joursDispo };
}

// Photos à montrer par figurant·e dans ces documents : celles de la
// candidature (envoyées ou reprises pour l'annonce), sinon celles du compte.
export async function getPhotosDesCandidatures(items: ConfirmedBooking[]): Promise<Map<string, FigurantPhotoWithUrl[]>> {
  const [parFigurant, parCandidature] = await Promise.all([
    getPhotosByFigurantId(items.map((i) => i.figurant.id)),
    getPhotosParCandidature(items.map((i) => i.id)),
  ]);
  return new Map(items.map((i) => [i.figurant.id, parCandidature.get(i.id) ?? parFigurant.get(i.figurant.id) ?? []]));
}

// Candidature d'origine de profils bookés sur un projet (la plus récente si
// plusieurs annonces), pour la rouvrir depuis Bookings (message, photos,
// réponses aux questions).
export async function getCandidatureParFigurant(projetId: string, figurantIds: string[]): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const map = new Map<string, string>();
  const ids = Array.from(new Set(figurantIds));
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("candidatures")
      .select("id, figurant_id, created_at, annonces!inner(projet_id)")
      .eq("annonces.projet_id", projetId)
      .in("figurant_id", ids.slice(i, i + 150))
      .order("created_at", { ascending: false })
      .returns<{ id: string; figurant_id: string }[]>();
    for (const c of data ?? []) if (!map.has(c.figurant_id)) map.set(c.figurant_id, c.id);
  }
  return map;
}
