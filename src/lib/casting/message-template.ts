import type { CastingRole } from "./types";

// Modèle par défaut du message d'invitation casting — écrit avec des tokens
// littéraux ({prenom}, {lien}...) pour être affiché puis modifié dans le
// composeur avant l'envoi manuel, pas interpolé côté serveur à la volée.
export function defaultCastingInviteMessage(
  role: Pick<CastingRole, "nom" | "date_tournage" | "nb_videos" | "photo_labels" | "demande_bande_demo" | "message_corps">
): string {
  if (role.message_corps) return role.message_corps;

  const besoin: string[] = [];
  if (role.nb_videos > 0) besoin.push(`${role.nb_videos} vidéo${role.nb_videos > 1 ? "s" : ""} de présentation`);
  if (role.photo_labels.length > 0) {
    besoin.push(`${role.photo_labels.length} photo${role.photo_labels.length > 1 ? "s" : ""} (${role.photo_labels.join(", ")})`);
  }
  if (role.demande_bande_demo) besoin.push("un lien vers votre bande démo");

  return [
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
  ].join("\n");
}
