import type { CastingRole } from "./types";

// Modèles par défaut des messages casting — écrits avec des tokens
// littéraux ({prenom}, {lien}...) pour être affichés puis modifiés dans le
// composeur avant l'envoi manuel, pas interpolés côté serveur à la volée.
// La signature apparaît toujours quelque part — jamais une formule
// générique du style "L'équipe casting", pour que le figurant sache qui lui
// écrit réellement. {signature} se résout côté composeur (voir
// getProjetSignatureOrOwnerName) sur la signature calibrée du projet, ou à
// défaut le nom de la cheffe propriétaire. withSignature ne sert plus qu'au
// texte libre calibré sur le rôle (message_corps) — les modèles générés
// placent {signature} eux-mêmes, juste après le bonjour.
function withSignature(body: string): string {
  if (body.includes("{signature}")) return body;
  return `${body}\n\n{signature}`;
}

export function defaultCastingInviteMessage(
  role: Pick<CastingRole, "nom" | "date_tournage" | "nb_videos" | "photo_labels" | "demande_bande_demo" | "message_corps">
): string {
  if (role.message_corps) return withSignature(role.message_corps);

  const besoin: string[] = [];
  if (role.nb_videos > 0) besoin.push(`${role.nb_videos} vidéo${role.nb_videos > 1 ? "s" : ""} de présentation`);
  if (role.photo_labels.length > 0) {
    besoin.push(`${role.photo_labels.length} photo${role.photo_labels.length > 1 ? "s" : ""} (${role.photo_labels.join(", ")})`);
  }
  if (role.demande_bande_demo) besoin.push("un lien vers votre bande démo");

  return [
    "Bonjour {prenom},",
    "",
    "{signature}",
    "",
    `L'équipe de casting du projet « {projet} » vous propose pour le rôle « {role} »` +
      (role.date_tournage ? " (tournage le {date})" : "") +
      ".",
    "",
    besoin.length > 0 ? `Merci de nous envoyer, via ce lien : ${besoin.join(", ")}.` : "Merci de tout envoyer via ce lien : {lien}",
    ...(besoin.length > 0 ? ["", "{lien}"] : []),
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  ].join("\n");
}

// Convocation présentiel — {lieu} et {horaire} sont remplis automatiquement
// par profil (lieu + créneau de sa journée de casting présentiel), voir
// CastingRoleSection. Signature placée juste après le bonjour plutôt qu'en
// bas : plus propre visuellement une fois le PDF du rôle joint (l'aperçu de
// pièce jointe de la messagerie ne vient plus s'intercaler dans un bloc
// signature qui traîne en fin de message).
export function defaultCastingPresentielMessage(): string {
  return [
    "Bonjour {prenom},",
    "",
    "{signature}",
    "",
    "Ton rendez-vous de casting pour le rôle « {role} » sur « {projet} » est confirmé :",
    "{horaire}",
    "{lieu}",
    "",
    "Merci de te présenter à l'heure indiquée.",
  ].join("\n");
}
