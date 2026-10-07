"use client";

import { compressImage } from "./compress-image";

// Les fonctions Vercel refusent les envois de plus de 4,5 Mo : une photo de
// téléphone envoyée telle quelle échouait sans message. Une photo de profil
// n'a besoin que de quelques centaines de pixels.
const TAILLE_MAX = 4 * 1024 * 1024;

export async function prepareAvatar(file: File): Promise<{ file: File } | { error: string }> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    return { error: "Ce fichier n'est pas une image." };
  }
  const reduite = await compressImage(file, { maxDimension: 800, quality: 0.85, skipBelowBytes: 0 });
  // compressImage renvoie l'original quand le navigateur ne sait pas lire
  // le format (HEIC d'iPhone hors Safari) : il ne s'afficherait pas ailleurs.
  if (/heic|heif/i.test(reduite.type) || /\.(heic|heif)$/i.test(reduite.name)) {
    return { error: "Format HEIC (iPhone) non lu par ce navigateur : choisis une photo JPEG ou PNG, ou réessaie depuis Safari." };
  }
  if (reduite.size > TAILLE_MAX) {
    return { error: "Photo trop lourde (4 Mo maximum) : choisis-en une autre." };
  }
  return { file: reduite };
}
