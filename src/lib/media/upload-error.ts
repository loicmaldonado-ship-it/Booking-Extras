/**
 * Messages utilisateur pour les échecs Storage, sans exposer d'erreur brute
 * (URL signée, chemin interne, nom de bucket, détails réseau).
 * L'annulation reste un résultat distinct, jamais assimilé à un envoi réussi.
 */
export function translateUploadErrorMessage(message: string): string {
  if (/abort(?:ed)?|cancel(?:led|ed)?|annul[ée]/i.test(message)) {
    return "Envoi annulé. Tu peux sélectionner le fichier puis réessayer.";
  }
  if (/too.large|payload.too.large|exceeded.the.maximum.allowed.size|maximum.file.size|size.limit|entity.too.large|413/i.test(message)) {
    return "Ce fichier est trop volumineux même après réduction. Choisis un fichier plus léger ou une vidéo plus courte.";
  }
  if (/mime|content.type|media.type|unsupported.format|invalid.file|file.type/i.test(message)) {
    return "Format de fichier non accepté. Essaie un JPEG, PNG ou une vidéo compatible avec ton navigateur.";
  }
  if (/timeout|timed.out|takes.too.long|délai|trop.de.temps/i.test(message)) {
    return "L'envoi a pris trop de temps. Vérifie ta connexion et réessaie.";
  }
  if (/network|failed.to.fetch|fetch.failed|load.failed|connection|offline|réseau/i.test(message)) {
    return "Connexion interrompue pendant l'envoi. Vérifie ta connexion et réessaie.";
  }
  if (/unauthori[sz]ed|forbidden|invalid.token|expired|signature|access.denied|permission|401|403/i.test(message)) {
    return "Lien d'envoi expiré ou accès refusé. Actualise la page puis réessaie.";
  }
  if (/not.supported|not.implemented|codec|browser|notallowederror/i.test(message)) {
    return "Cet appareil ne peut pas préparer ce fichier. Essaie un autre format ou navigateur.";
  }
  // Les exceptions SDK peuvent contenir des chemins Storage ou des tokens.
  return "Envoi impossible pour le moment. Réessaie ou sélectionne un autre fichier.";
}
