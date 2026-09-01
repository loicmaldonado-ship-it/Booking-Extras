// Message de convocation présentiel — {lieu} et {horaire} sont remplis
// automatiquement par créneau (voir PresentielJourneeTable), pas besoin de
// les saisir à la main comme pour une invitation selftape classique.
export function defaultPresentielConvocationMessage(): string {
  return (
    "Bonjour {prenom},\n\n" +
    "Ton rendez-vous de casting pour « {projet} » est confirmé :\n" +
    "{horaire}\n" +
    "{lieu}\n\n" +
    "Merci de te présenter à l'heure indiquée.\n\n" +
    "{signature}"
  );
}
