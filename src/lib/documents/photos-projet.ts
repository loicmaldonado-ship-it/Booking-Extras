import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhotosByFigurantId, getPhotosParCandidature, type FigurantPhotoWithUrl } from "@/lib/documents/data";

// Photos des trombis et fiches mensuration d'une personne sur un projet :
// jusqu'à 3, la première étant la photo principale (trombi).
// 1. Choix fait dans Booking (projet_photos_choisies) — sauf si un essayage
//    a ajouté des photos depuis : l'essayage reprend la main.
// 2. Sinon, par défaut : photos de l'essayage sur ce projet, puis celles de
//    la candidature (portrait, en pied, selfie…), puis celles du compte
//    (portrait d'abord).
export const PHOTOS_PAR_DOCUMENT = 3;

export type PhotosProjet = {
  essayage: FigurantPhotoWithUrl[];
  candidature: FigurantPhotoWithUrl[];
  compte: FigurantPhotoWithUrl[];
  selection: FigurantPhotoWithUrl[];
  manuel: boolean;
};

const ORDRE_TYPES = ["portrait", "pied", "selfie", "autre", "vehicule", "casting"];
const rang = (type: string) => {
  const i = ORDRE_TYPES.indexOf(type);
  return i === -1 ? ORDRE_TYPES.length : i;
};

export async function getPhotosProjet(projetId: string, figurantIds: string[]): Promise<Map<string, PhotosProjet>> {
  const resultat = new Map<string, PhotosProjet>();
  const ids = Array.from(new Set(figurantIds));
  if (ids.length === 0) return resultat;
  const supabase = createAdminClient();

  // Dernière candidature de chaque personne sur une annonce de ce projet.
  const candidatures: { id: string; figurant_id: string }[] = [];
  const choix: { figurant_id: string; photo_ids: string[]; updated_at: string }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const paquet = ids.slice(i, i + 150);
    const [{ data: c }, { data: ch }] = await Promise.all([
      supabase
        .from("candidatures")
        .select("id, figurant_id, annonces!inner(projet_id)")
        .eq("annonces.projet_id", projetId)
        .in("figurant_id", paquet)
        .order("created_at", { ascending: false }),
      supabase
        .from("projet_photos_choisies")
        .select("figurant_id, photo_ids, updated_at")
        .eq("projet_id", projetId)
        .in("figurant_id", paquet),
    ]);
    candidatures.push(...(c ?? []));
    choix.push(...(ch ?? []));
  }
  const candidatureParFigurant = new Map<string, string>();
  for (const c of candidatures) if (!candidatureParFigurant.has(c.figurant_id)) candidatureParFigurant.set(c.figurant_id, c.id);
  const choixParFigurant = new Map(choix.map((c) => [c.figurant_id, c]));

  const [photosCompte, photosCandidature] = await Promise.all([
    getPhotosByFigurantId(ids),
    getPhotosParCandidature(Array.from(candidatureParFigurant.values())),
  ]);

  for (const figurantId of ids) {
    const toutes = (photosCompte.get(figurantId) ?? []).filter((p) => p.url);
    const essayage = toutes
      .filter((p) => p.type === "tenue" && p.projet_id === projetId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const candidatureId = candidatureParFigurant.get(figurantId);
    const candidature = (candidatureId ? (photosCandidature.get(candidatureId) ?? []) : [])
      .filter((p) => p.url)
      .sort((a, b) => rang(a.type) - rang(b.type));
    const dejaVues = new Set([...essayage, ...candidature].map((p) => p.id));
    const compte = toutes
      .filter((p) => p.type !== "tenue" && !dejaVues.has(p.id))
      .sort((a, b) => rang(a.type) - rang(b.type) || b.created_at.localeCompare(a.created_at));

    const parId = new Map([...compte, ...candidature, ...essayage].map((p) => [p.id, p]));
    const enregistre = choixParFigurant.get(figurantId);
    const essayageApresChoix = !!enregistre && essayage.some((p) => p.created_at > enregistre.updated_at);
    const manuelles = enregistre && !essayageApresChoix
      ? enregistre.photo_ids.map((id) => parId.get(id)).filter((p): p is FigurantPhotoWithUrl => !!p)
      : [];

    const parDefaut: FigurantPhotoWithUrl[] = [];
    for (const p of [...essayage, ...candidature, ...compte]) {
      if (!parDefaut.some((d) => d.id === p.id)) parDefaut.push(p);
    }

    resultat.set(figurantId, {
      essayage,
      candidature,
      compte,
      selection: (manuelles.length > 0 ? manuelles : parDefaut).slice(0, PHOTOS_PAR_DOCUMENT),
      manuel: manuelles.length > 0,
    });
  }
  return resultat;
}

// Même sélection, présentée aux documents existants (trombis, fiches) : les
// types sont réécrits dans l'ordre choisi (portrait, en pied, autre) pour
// que pickPortrait / pickFichePhotos les gardent dans cet ordre.
export async function getPhotosDocumentsProjet(projetId: string, figurantIds: string[]) {
  const detail = await getPhotosProjet(projetId, figurantIds);
  const typesDansLOrdre = ["portrait", "pied", "autre"] as const;
  return new Map(
    Array.from(detail, ([figurantId, d]) => [
      figurantId,
      d.selection.map((p, i) => ({ ...p, type: typesDansLOrdre[i] ?? "autre", projet_id: null })),
    ])
  );
}
