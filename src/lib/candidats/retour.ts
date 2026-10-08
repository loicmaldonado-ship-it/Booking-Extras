// Page où renvoyer un·e candidat·e après connexion (lien « Me connecter »
// depuis une annonce). Seules les pages de candidature sont acceptées, pour
// ne jamais rediriger vers une adresse fournie de l'extérieur.
export function retourAutorise(v: unknown): string | null {
  return typeof v === "string" && /^\/postuler\/[A-Za-z0-9-]+$/.test(v) ? v : null;
}
