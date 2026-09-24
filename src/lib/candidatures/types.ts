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
  // null = onglet commun à toutes les annonces
  annonce_id: string | null;
};

// Tout ce que le mode "tri rapide" affiche pour une candidature, chargé à
// la demande (une à la fois) plutôt que pour toute la liste d'un coup.
export type TriCandidature = {
  id: string;
  onglet_id: string | null;
  message: string | null;
  created_at: string;
  figurant: {
    id: string;
    prenom: string;
    nom: string;
    ville: string | null;
    code_postal: string | null;
    genre: string | null;
    age: number | null;
    taille_cm: number | null;
    poids_kg: number | null;
    pointure: number | null;
    veste: string | null;
    pantalon: string | null;
    vehicule: string | null;
    compte_myrole: boolean;
  };
  photos: { url: string; type: string }[];
  questions: { label: string; reponse: boolean }[];
  dates: { date: string; disponible: boolean }[];
  lienBandeDemo: string | null;
  tournagesConfirmes: number;
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
