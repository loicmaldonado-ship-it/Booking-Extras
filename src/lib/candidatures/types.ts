// Conservé pour compat historique (colonne encore en base) — l'app ne lit
// plus que candidature_onglets / onglet_id pour le rangement des profils.
export type CandidatureStatut = "en_attente" | "retenu" | "refuse";
export type Cachet =
  | "Figurant"
  | "Silhouette"
  | "Silhouette parlante"
  | "Doublure simple"
  | "Doublure polyvalente"
  | "Rôle";

export const CACHETS: Cachet[] = [
  "Figurant",
  "Silhouette",
  "Silhouette parlante",
  "Doublure simple",
  "Doublure polyvalente",
  "Rôle",
];

// Nom de l'onglet spécial fixe (protégé contre la suppression) — un simple
// rangement parmi d'autres, le profil reste visible dans la candidature.
export const ONGLET_OUT_BE = "OUT BE";

export type CandidatureOngletCouleur = "default" | "coral" | "turquoise" | "yellow" | "danger";

export type CandidatureOnglet = {
  id: string;
  nom: string;
  couleur: CandidatureOngletCouleur;
  fixe: boolean;
  ordre: number;
};

export type Candidature = {
  id: string;
  figurant_id: string;
  annonce_id: string;
  statut: CandidatureStatut;
  onglet_id: string | null;
  // fonction = ce que la personne joue dans la scène (passant, boulangère...)
  fonction_assignee: string | null;
  // cachet = la catégorie de paie/contrat (silhouette ou rôle), distincte de la fonction
  cachet_assigne: Cachet | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};
