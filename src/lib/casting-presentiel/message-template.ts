// Message de convocation présentiel — {lieu}, {horaire} et {role} sont
// remplis automatiquement par profil (voir PresentielJourneeTable), pas
// besoin de les saisir à la main comme pour une invitation selftape
// classique. Signature en dernier, après le corps du message.
export function defaultPresentielConvocationMessage(): string {
  return (
    "Bonjour {prenom},\n\n" +
    "Ton rendez-vous de casting pour le rôle « {role} » sur « {projet} » est confirmé :\n" +
    "{horaire}\n" +
    "{lieu}\n\n" +
    "Merci de te présenter à l'heure indiquée.\n\n" +
    "{signature}"
  );
}
