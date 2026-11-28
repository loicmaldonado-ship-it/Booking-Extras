// Mail envoyé aux agents avec leur lien. Fonctions pures (testables seules) :
// {agent}, {projet}, {lien}, {signature} sont remplacés pour chaque agent.

export const SUJET_AGENT_PAR_DEFAUT = "Rôles à pourvoir — {projet}";

export const CORPS_AGENT_PAR_DEFAUT = [
  "Bonjour {agent},",
  "",
  "Nous cherchons des comédien·nes pour « {projet} ». Voici ton lien personnel : tu y vois les rôles à pourvoir et tu peux nous proposer des profils (photos, infos, lien vers la page de comédien·ne) :",
  "",
  "{lien}",
  "",
  "Ce lien est le tien : toi seul·e vois tes propositions.",
  "",
  "{signature}",
].join("\n");

export function composerMailAgent(
  modele: string,
  valeurs: { agent: string; projet: string; lien: string; signature: string }
): string {
  const rempli = modele
    .replaceAll("{agent}", valeurs.agent)
    .replaceAll("{projet}", valeurs.projet)
    .replaceAll("{lien}", valeurs.lien)
    .replaceAll("{signature}", valeurs.signature);
  // Sans {lien} dans le message, l'agent ne pourrait pas ouvrir son espace : on l'ajoute.
  const avecLien = modele.includes("{lien}") ? rempli : `${rempli.trimEnd()}\n\n${valeurs.lien}`;
  return avecLien.trim();
}
