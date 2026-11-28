/** Les médias privés ne doivent jamais entrer dans le cache public de Next. */
export function isPrivateStorageImage(src: unknown): boolean {
  if (typeof src !== "string") return false;
  try {
    const path = new URL(src, "http://booking.invalid").pathname;
    return path.startsWith("/storage/v1/object/sign/") || path.startsWith("/storage/v1/render/image/sign/") || path.startsWith("/storage/v1/object/authenticated/");
  } catch { return false; }
}
