"use client";

// Réduit une photo côté navigateur avant l'envoi (téléphone qui prend des
// photos en 12-48 Mpx) — redimensionne au plus grand côté et recompresse en
// JPEG, sans repasser par le serveur. Les envois vers les fonctions Vercel
// sont limités à 4,5 Mo : une photo non réduite fait échouer le formulaire.
//
// Lecture de l'image, du plus rapide au plus lent :
// 1. createImageBitmap (navigateurs récents) ;
// 2. <img> (anciens Safari, navigateurs intégrés de Facebook/Instagram,
//    et HEIC sur Safari, qui sait l'afficher) ;
// 3. pour un HEIC illisible (Chrome, Firefox, Android) : conversion par
//    heic-to, chargé seulement dans ce cas (bibliothèque lourde).

const RE_HEIC = /\.(heic|heif)$/i;

export function estHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || RE_HEIC.test(file.name);
}

type Source = { source: CanvasImageSource; width: number; height: number; liberer: () => void };

async function viaBitmap(blob: Blob): Promise<Source> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Anciens Safari : les options ne sont pas reconnues.
    bitmap = await createImageBitmap(blob);
  }
  return { source: bitmap, width: bitmap.width, height: bitmap.height, liberer: () => bitmap.close() };
}

async function viaImg(blob: Blob): Promise<Source> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  if (!img.naturalWidth) {
    URL.revokeObjectURL(url);
    throw new Error("image vide");
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, liberer: () => URL.revokeObjectURL(url) };
}

async function viaHeicTo(file: File): Promise<Source> {
  const { heicTo } = await import("heic-to/next");
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  return viaImg(jpeg);
}

async function lire(file: File): Promise<Source> {
  try {
    return await viaBitmap(file);
  } catch {}
  try {
    return await viaImg(file);
  } catch (e) {
    if (estHeic(file)) return viaHeicTo(file);
    throw e;
  }
}

function nomJpeg(nom: string): string {
  return /\.\w+$/.test(nom) ? nom.replace(/\.\w+$/, ".jpg") : `${nom}.jpg`;
}

// Renvoie une photo JPEG réduite, ou une erreur lisible si le navigateur
// n'a vraiment pas pu la lire. Un HEIC est toujours converti (il ne
// s'afficherait pas ailleurs que sur Safari).
export async function prepareImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number; skipBelowBytes?: number }
): Promise<{ file: File } | { error: string }> {
  const heic = estHeic(file);
  if (!heic && !file.type.startsWith("image/")) return { error: "Ce fichier n'est pas une photo." };

  const maxDimension = opts?.maxDimension ?? 1600;
  const quality = opts?.quality ?? 0.8;
  const skipBelowBytes = opts?.skipBelowBytes ?? 300_000;
  if (!heic && file.size < skipBelowBytes) return { file };

  let image: Source;
  try {
    image = await lire(file);
  } catch {
    return {
      error: heic
        ? "Cette photo HEIC n'a pas pu être convertie. Choisis-en une autre ou réessaie avec une photo JPEG."
        : "Cette photo n'a pas pu être lue. Choisis-en une autre (JPEG ou PNG).",
    };
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return heic ? { error: "Conversion impossible sur ce navigateur." } : { file };
    ctx.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return heic ? { error: "Conversion impossible sur ce navigateur." } : { file };
    if (!heic && blob.size >= file.size) return { file };
    return { file: new File([blob], nomJpeg(file.name), { type: "image/jpeg" }) };
  } finally {
    image.liberer();
  }
}

// Version « fail-open » historique : renvoie le fichier d'origine si la
// réduction échoue, plutôt que de bloquer l'envoi.
export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number; skipBelowBytes?: number }
): Promise<File> {
  const res = await prepareImage(file, { maxDimension: 1920, quality: 0.82, skipBelowBytes: 400_000, ...opts });
  return "file" in res ? res.file : file;
}

// Pour les <input type="file"> : certains navigateurs (Android) ne rangent
// pas le HEIC sous image/*.
export const ACCEPT_IMAGES = "image/*,.heic,.heif";
