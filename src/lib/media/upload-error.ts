// Traduit le message brut (anglais) de Supabase Storage en un message
// compréhensible — la compression automatique gère la grande majorité des
// cas ; celui-ci ne devrait arriver que sur un navigateur qui ne sait pas
// compresser (très ancien) avec un fichier resté volumineux.
export function translateUploadErrorMessage(message: string): string {
  if (/exceeded the maximum allowed size/i.test(message)) {
    return "Ce fichier est trop volumineux même après réduction automatique. Essaie une vidéo/photo plus légère, ou depuis un autre navigateur/appareil.";
  }
  return message;
}
