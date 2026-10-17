// Fiche que la personne complète en envoyant ses photos / vidéos de
// casting (surtout utile pour un profil ajouté rapidement par la cheffe).
export type FicheCasting = {
  date_naissance: string | null;
  genre: string | null;
  code_postal: string | null;
  ville: string | null;
  taille_cm: number | null;
  poids_kg: number | null;
  pointure: number | null;
  veste: string | null;
  pantalon: string | null;
};
