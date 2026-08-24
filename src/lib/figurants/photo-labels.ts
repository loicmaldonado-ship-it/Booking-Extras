import type { GalleryPhoto } from "@/components/ui/zoomable-image";
import type { PhotoType } from "./types";

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  portrait: "Portrait",
  pied: "Pied",
  autre: "Autre",
  selfie: "Selfie",
  tenue: "Tenue",
  vehicule: "Véhicule",
};

// Galerie des photos d'UNE personne (pas de toute une liste) — les flèches
// du lightbox ne doivent parcourir que le trombi de ce profil précis.
export function toGalleryPhotos(photos: { url: string | null; type: PhotoType }[] | undefined): GalleryPhoto[] {
  return (photos ?? [])
    .filter((p): p is { url: string; type: PhotoType } => !!p.url)
    .map((p) => ({ src: p.url, alt: PHOTO_TYPE_LABELS[p.type] }));
}

export function galleryIndexOfUrl(gallery: GalleryPhoto[], url: string | null): number {
  if (!url) return 0;
  const idx = gallery.findIndex((p) => p.src === url);
  return idx === -1 ? 0 : idx;
}
