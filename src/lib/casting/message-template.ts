import type { CastingRole } from "./types";

// Modèle par défaut du message d'invitation casting — écrit avec des tokens
// littéraux ({prenom}, {lien}...) pour être affiché puis modifié dans le
// composeur avant l'envoi manuel, pas interpolé côté serveur à la volée.
// La signature apparaît toujours en bas du message — jamais une formule
// générique du style "L'équipe casting", pour que le figurant sache qui lui
// écrit réellement. {signature} se résout côté composeur (voir
// getProjetSignatureOrOwnerName) sur la signature calibrée du projet, ou à
// défaut le nom de la cheffe propriétaire.
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

  return withSignature(
    [
      "Bonjour {prenom},",
      "",
      `L'équipe de casting du projet « {projet} » vous propose pour le rôle « {role} »` +
        (role.date_tournage ? " (tournage le {date})" : "") +
        ".",
      "",
      besoin.length > 0 ? `Merci de nous envoyer, via ce lien : ${besoin.join(", ")}.` : "Merci de tout envoyer via ce lien : {lien}",
      ...(besoin.length > 0 ? ["", "{lien}"] : []),
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    ].join("\n")
  );
}

// Convocation présentiel — {lieu} et {horaire} sont remplis automatiquement
// par profil (lieu + créneau de sa journée de casting présentiel), voir
// CastingRoleSection.
export function defaultCastingPresentielMessage(role: Pick<CastingRole, "nom">): string {
  return withSignature(
    [
      "Bonjour {prenom},",
      "",
      `Ton rendez-vous de casting pour le rôle « ${role.nom} » sur « {projet} » est confirmé :`,
      "{horaire}",
      "{lieu}",
      "",
      "Merci de te présenter à l'heure indiquée.",
    ].join("\n")
  );
}
