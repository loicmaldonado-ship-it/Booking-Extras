"use client";

import { prepareImage } from "./compress-image";

// Les fonctions Vercel refusent les envois de plus de 4,5 Mo : une photo de
// téléphone envoyée telle quelle échouait sans message. Une photo de profil
// n'a besoin que de quelques centaines de pixels.
const TAILLE_MAX = 4 * 1024 * 1024;

export async function prepareAvatar(file: File): Promise<{ file: File } | { error: string }> {
  const res = await prepareImage(file, { maxDimension: 800, quality: 0.85, skipBelowBytes: 0 });
  if ("error" in res) return res;
  if (res.file.size > TAILLE_MAX) return { error: "Photo trop lourde (4 Mo maximum) : choisis-en une autre." };
  return res;
}
