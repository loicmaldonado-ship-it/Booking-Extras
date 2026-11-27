import type { CastingEntry } from "./types";
import type { OptionsReel } from "@/lib/partage/data";
import type { CastingRealEntryItem } from "@/components/casting/casting-real-entry-card";

// Ce que le·la réal voit d'un profil, partagé entre le lien public et l'aperçu
// de l'équipe : une seule règle, pour que l'aperçu ne mente jamais.

// Clés des médias retirés du lien (casting_entries.medias_masques).
export const clePhotoReel = (photoId: string) => `p:${photoId}`;
export const cleVideoReel = (chemin: string) => `v:${chemin}`;

// Mensurations montrées au·à la réal (seulement celles renseignées).
export function mensurationsDe(f: CastingEntry["figurants"], options: OptionsReel): CastingRealEntryItem["mensurations"] {
  if (!f) return [];
  const liste: CastingRealEntryItem["mensurations"] = [];
  if (options.taille && f.taille_cm) liste.push({ cle: "mens_taille", valeur: `${f.taille_cm} cm` });
  if (options.mensurations) {
    if (f.poids_kg) liste.push({ cle: "mens_poids", valeur: `${f.poids_kg} kg` });
    if (f.pointure) liste.push({ cle: "mens_pointure", valeur: String(Number(f.pointure)) });
    if (f.veste) liste.push({ cle: "mens_veste", valeur: f.veste });
    if (f.pantalon) liste.push({ cle: "mens_pantalon", valeur: f.pantalon });
  }
  return liste;
}

// Photos du profil (portrait, en pied, selfie…), montrées au·à la réal en
// plus de celles envoyées pour le casting. Les essayages d'autres projets
// et les photos de véhicule restent de côté.
const LIBELLES_PHOTO: Record<string, { fr: string; en: string }> = {
  portrait: { fr: "Portrait", en: "Portrait" },
  pied: { fr: "En pied", en: "Full length" },
  selfie: { fr: "Selfie", en: "Selfie" },
  autre: { fr: "Photo", en: "Photo" },
  tenue: { fr: "Essayage", en: "Fitting" },
};

export function photosDuProfil(
  photos: { id: string; type: string; url: string | null; projet_id: string | null }[] | undefined,
  projetId: string,
  lang: "fr" | "en"
): { id: string; label: string; url: string }[] {
  return (photos ?? [])
    .filter((p) => p.url && p.type in LIBELLES_PHOTO && (p.type !== "tenue" || p.projet_id === projetId))
    .map((p) => ({ id: p.id, label: LIBELLES_PHOTO[p.type][lang], url: p.url! }));
}
