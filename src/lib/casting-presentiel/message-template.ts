// Message de convocation présentiel — {lieu}, {horaire} et {role} sont
// remplis automatiquement par profil (voir PresentielJourneeTable), pas
// besoin de les saisir à la main comme pour une invitation selftape
// classique. Signature juste après le bonjour plutôt qu'en bas : plus
// propre visuellement, l'aperçu de pièce jointe de la messagerie ne vient
// plus s'intercaler dans un bloc signature qui traîne en fin de message.
export function defaultPresentielConvocationMessage(): string {
  return (
    "Bonjour {prenom},\n\n" +
    "{signature}\n\n" +
    "Ton rendez-vous de casting pour le rôle « {role} » sur « {projet} » est confirmé :\n" +
    "{horaire}\n" +
    "{lieu}\n\n" +
    "Merci de te présenter à l'heure indiquée."
  );
}
