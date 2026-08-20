export type Civilite = "Mme" | "M." | "Autre";
export type Pronom = "Elle" | "Il" | "Iel";
export type Genre = "Femme" | "Homme" | "Non-binaire";
export type PhotoType = "portrait" | "pied" | "autre" | "selfie";

export type Figurant = {
  id: string;
  civilite: Civilite | null;
  prenom: string;
  nom: string;
  pronom: Pronom | null;
  genre: Genre | null;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  date_naissance: string | null;
  commune_naissance: string | null;
  logement_france: string | null;
  token_disponibilite: string;
  taille_cm: number | null;
  poids_kg: number | null;
  pointure: number | null;
  tour_poitrine_cm: number | null;
  tour_taille_cm: number | null;
  tour_hanches_cm: number | null;
  tour_tete_cm: number | null;
  tour_cou_cm: number | null;
  jambes_ext_cm: number | null;
  jambes_int_cm: number | null;
  carrure_cm: number | null;
  veste: string | null;
  pantalon: string | null;
  gant: string | null;
  couleur_yeux: string | null;
  couleur_cheveux: string | null;
  compte_myrole: boolean;
  acces_compte: boolean;
  tags: string[];
  notes_internes: string | null;
  created_at: string;
  updated_at: string;
};

export type FigurantPhoto = {
  id: string;
  figurant_id: string;
  type: PhotoType;
  storage_path: string;
  prise_le: string | null;
  created_at: string;
  url?: string;
};

export type FigurantLien = {
  id: string;
  figurant_id: string;
  label: string;
  url: string;
  created_at: string;
};

export const CIVILITES: Civilite[] = ["Mme", "M.", "Autre"];
export const PRONOMS: Pronom[] = ["Elle", "Il", "Iel"];
export const GENRES: Genre[] = ["Femme", "Homme", "Non-binaire"];
