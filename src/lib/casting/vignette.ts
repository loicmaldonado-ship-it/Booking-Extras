import { pickPortrait, type FigurantPhotoWithUrl } from "@/lib/documents/data";

export type PhotoVignette = { id: string; url: string; label: string };

const LIBELLES: Record<string, string> = {
  portrait: "Portrait",
  pied: "En pied",
  selfie: "Selfie",
  autre: "Photo",
  tenue: "Essayage",
};

// Photos proposables pour la vignette d'un profil dans un rôle : celles du
// profil (+ essayages de ce projet) et celles envoyées pour CE rôle.
export function photosPourVignette(
  entry: { id: string },
  photos: FigurantPhotoWithUrl[] | undefined,
  projetId: string
): PhotoVignette[] {
  const envoyees: PhotoVignette[] = [];
  const profil: PhotoVignette[] = [];
  for (const p of photos ?? []) {
    if (!p.url) continue;
    if (p.type === "casting") {
      if (p.casting_entry_id === entry.id) envoyees.push({ id: p.id, url: p.url, label: p.label ?? "Photo" });
    } else if (p.type in LIBELLES && (p.type !== "tenue" || p.projet_id === projetId)) {
      profil.push({ id: p.id, url: p.url, label: LIBELLES[p.type] });
    }
  }
  return [...envoyees, ...profil];
}

// Photo choisie par l'équipe si elle existe encore, sinon le choix
// automatique habituel (essayage du projet, sinon portrait).
export function vignetteCasting(
  entry: { photo_vignette_id: string | null },
  photos: FigurantPhotoWithUrl[] | undefined,
  projetId: string
): string | null {
  const choisie = entry.photo_vignette_id ? photos?.find((p) => p.id === entry.photo_vignette_id)?.url : null;
  return choisie ?? pickPortrait(photos, projetId)?.url ?? null;
}
