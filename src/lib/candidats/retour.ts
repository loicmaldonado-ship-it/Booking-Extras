// Page où renvoyer un·e candidat·e après connexion (lien « Me connecter »
// depuis une annonce ou un lien rapide de casting). Seules ces pages sont
// acceptées, pour ne jamais rediriger vers une adresse fournie de
// l'extérieur.
export function retourAutorise(v: unknown): string | null {
  return typeof v === "string" && /^\/(postuler|casting\/rejoindre)\/[A-Za-z0-9-]+$/.test(v) ? v : null;
}
