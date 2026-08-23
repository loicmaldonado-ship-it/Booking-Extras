export type ProjetType = "Film" | "Série" | "Publicité" | "Clip" | "Autre";
export type Convention = "Cinéma" | "Audiovisuelle";

export type Projet = {
  id: string;
  nom: string;
  type: ProjetType | null;
  convention: Convention | null;
  realisateur: string | null;
  societe_production: string | null;
  diffuseur: string | null;
  confidentiel: boolean;
  nom_code: string | null;
  date_debut: string | null;
  date_fin: string | null;
  lieu: string | null;
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  besoins_figuration: string | null;
  synopsis: string | null;
  signature: string | null;
  gmail_smtp_user: string | null;
  gmail_smtp_app_password: string | null;
  covoiturage_tarif_base: number;
  covoiturage_tarif_passager: number;
  archive: boolean;
  archive_le: string | null;
  created_at: string;
  updated_at: string;
};

export const PROJET_TYPES: ProjetType[] = ["Film", "Série", "Publicité", "Clip", "Autre"];
export const CONVENTIONS: Convention[] = ["Cinéma", "Audiovisuelle"];

// Nom à afficher à un candidat/figurant externe : le nom de code si le
// projet est confidentiel (avec un repli générique tant qu'il n'est pas
// renseigné), sinon le vrai nom.
export function projetNomPublic(
  projet: { nom: string; confidentiel: boolean; nom_code?: string | null } | null | undefined,
  fallback = "Projet confidentiel"
) {
  if (!projet) return fallback;
  if (!projet.confidentiel) return projet.nom;
  return projet.nom_code || fallback;
}
