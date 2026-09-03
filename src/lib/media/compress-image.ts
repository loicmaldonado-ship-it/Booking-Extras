"use client";

// Réduit une photo côté navigateur avant l'envoi (téléphone qui prend des
// photos en 12-48 Mpx) — redimensionne au plus grand côté et recompresse en
// JPEG, sans repasser par le serveur. Toujours "fail-open" : si quoi que ce
// soit échoue (format non décodable comme certains HEIC sur Chrome/Firefox,
// petite image déjà légère, navigateur trop ancien...), on renvoie le
// fichier d'origine tel quel plutôt que de bloquer l'envoi.
export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number; skipBelowBytes?: number }
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxDimension = opts?.maxDimension ?? 1920;
  const quality = opts?.quality ?? 0.82;
  const skipBelowBytes = opts?.skipBelowBytes ?? 400_000;
  if (file.size < skipBelowBytes) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
