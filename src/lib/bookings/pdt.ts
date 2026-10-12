// Modification du plan de travail : message proposé aux profils basculés
// vers la nouvelle date. Calibrable par l'équipe (mémorisé par projet).
export const MODELE_PDT_DEFAUT = `Bonjour {prenom},

Le plan de travail de « {projet} » a changé : la journée du {ancienne_date} est déplacée au {nouvelle_date}.

Es-tu disponible le {nouvelle_date} ? Réponds-nous directement ici, on revient vers toi pour confirmer.

Merci !
{signature}`;

export const VARIABLES_PDT = ["{prenom}", "{projet}", "{ancienne_date}", "{nouvelle_date}", "{signature}"];

export function remplirModelePdt(
  modele: string,
  valeurs: { prenom: string; projet: string; ancienneDate: string; nouvelleDate: string; signature: string }
) {
  return modele
    .replaceAll("{prenom}", valeurs.prenom)
    .replaceAll("{projet}", valeurs.projet)
    .replaceAll("{ancienne_date}", valeurs.ancienneDate)
    .replaceAll("{nouvelle_date}", valeurs.nouvelleDate)
    .replaceAll("{signature}", valeurs.signature);
}
