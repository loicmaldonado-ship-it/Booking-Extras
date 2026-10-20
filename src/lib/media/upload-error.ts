// Traduit le message brut (anglais) de Supabase Storage en un message
// compréhensible (photos ; les vidéos ont le leur, voir upload-video.ts).
export function translateUploadErrorMessage(message: string): string {
  if (/exceeded the maximum allowed size/i.test(message)) {
    return "Cette photo est trop volumineuse. Essaie-en une plus légère, ou depuis un autre navigateur/appareil.";
  }
  return message;
}
