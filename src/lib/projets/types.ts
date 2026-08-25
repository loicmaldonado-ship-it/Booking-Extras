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
  annonce_photo_storage_path: string | null;
  archive: boolean;
  archive_le: string | null;
  created_at: string;
  updated_at: string;
};

// On ne supprime jamais un projet à la légère — il passe d'abord par
// "archivé" pour qu'on puisse y revenir si besoin. La suppression
// définitive n'est proposée qu'au bout d'1 an d'archivage.
export const DELAI_SUPPRESSION_MS = 365 * 24 * 60 * 60 * 1000;

export function projetSupprimableDepuis(archiveLe: string | null): Date | null {
  if (!archiveLe) return null;
  return new Date(new Date(archiveLe).getTime() + DELAI_SUPPRESSION_MS);
}

export function projetEstSupprimable(projet: { archive: boolean; archive_le: string | null }): boolean {
  const supprimableDepuis = projetSupprimableDepuis(projet.archive_le);
  return Boolean(projet.archive && supprimableDepuis && supprimableDepuis.getTime() <= Date.now());
}

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
