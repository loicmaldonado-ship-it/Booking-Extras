export type Civilite = "Mme" | "M." | "Autre";
export type Pronom = "Elle" | "Il" | "Iel";
export type Genre = "Femme" | "Homme" | "Non-binaire";
export type PhotoType = "portrait" | "pied" | "autre" | "selfie" | "tenue" | "vehicule" | "casting";

// Au-delà, une fiche devient difficile à parcourir et le stockage explose
// sans réel bénéfice pour le casting — appliqué partout où un candidat ou
// un membre de l'équipe peut ajouter une photo.
export const MAX_PHOTOS_PAR_FIGURANT = 7;

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
  code_postal: string | null;
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
  confirme: boolean;
  temporaire: boolean;
  temporaire_projet_id: string | null;
  tags: string[];
  notes_internes: string | null;
  a_vehicule: boolean | null;
  vehicule_velo: boolean;
  vehicule_moto: boolean;
  vehicule_scooter: boolean;
  vehicule_marque: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FigurantPhoto = {
  id: string;
  figurant_id: string;
  type: PhotoType;
  storage_path: string;
  prise_le: string | null;
  projet_id: string | null;
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

// Labels fixes utilisés pour les liens gérés depuis l'espace personnel du
// candidat (figurant_liens) — un seul lien par label et par figurant.
export const LIEN_BANDE_DEMO = "Bande démo";
export const LIEN_INSTAGRAM = "Instagram";

export const CIVILITES: Civilite[] = ["Mme", "M.", "Autre"];
export const PRONOMS: Pronom[] = ["Elle", "Il", "Iel"];
export const GENRES: Genre[] = ["Femme", "Homme", "Non-binaire"];
