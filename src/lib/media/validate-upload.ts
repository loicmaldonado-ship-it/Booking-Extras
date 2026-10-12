/** Verify file bytes on the server: browser-provided MIME types and extensions are untrusted. */
export type SafeImageType = "image/jpeg" | "image/png" | "image/webp";
export type ValidatedFile = { error?: string; mimeType?: SafeImageType; extension?: "jpg" | "png" | "webp" };

function detectedImageType(bytes: Uint8Array): SafeImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function validateImageUpload(file: File, maxBytes = 20 * 1024 * 1024): Promise<ValidatedFile> {
  if (!(file instanceof File) || file.size <= 0) return { error: "Choisis une image." };
  if (file.size > maxBytes) return { error: `Image trop lourde (${Math.round(maxBytes / (1024 * 1024))} Mo maximum).` };
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = detectedImageType(header);
  if (!mimeType || file.type !== mimeType) {
    return { error: "Image invalide : seuls les vrais fichiers JPEG, PNG ou WebP sont autorisés." };
  }
  return { mimeType, extension: mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp" };
}

export async function validatePdfUpload(file: File, maxBytes = 20 * 1024 * 1024): Promise<{ error?: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis un PDF." };
  if (file.size > maxBytes) return { error: "PDF trop volumineux." };
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (file.type !== "application/pdf" || String.fromCharCode(...header) !== "%PDF-") {
    return { error: "PDF invalide : le contenu du fichier ne correspond pas à un PDF." };
  }
  return {};
}
