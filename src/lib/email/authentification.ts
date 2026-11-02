// Authenticité d'une réponse par email (audit du 31/10/2026) : l'adresse « De » d'un mail se falsifie librement.
// Gmail vérifie SPF, DKIM et DMARC à la réception et l'écrit dans l'en-tête « Authentication-Results » qu'il AJOUTE
// EN TÊTE du message. On ne lit que le premier en-tête signé par Gmail (mx.google.com) : un en-tête placé plus bas
// par l'expéditeur ne compte pas. Une réponse est authentique si DMARC passe pour le domaine « De », ou si DKIM ou
// SPF passent pour un domaine aligné sur celui de l'adresse « De ».

export const AVERTISSEMENT_EXPEDITEUR =
  "⚠️ Expéditeur non vérifié : ce mail affiche l'adresse de cette personne, mais Gmail n'a pas pu confirmer qu'il vient d'elle. Vérifie avant d'en tenir compte.";

const SERVEUR_DE_CONFIANCE = "mx.google.com";

function sansCommentaires(valeur: string): string {
  let s = valeur;
  for (let i = 0; i < 5 && /\([^()]*\)/.test(s); i++) s = s.replace(/\([^()]*\)/g, " ");
  return s;
}

function domaineDe(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const v = valeur.trim().toLowerCase().replace(/^"|"$/g, "");
  const d = v.includes("@") ? v.slice(v.lastIndexOf("@") + 1) : v;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

// Alignement « relâché » (DMARC) : même domaine, ou l'un sous-domaine de l'autre.
function aligne(a: string | null, b: string): boolean {
  if (!a) return false;
  return a === b || a.endsWith("." + b) || b.endsWith("." + a);
}

/** headerLines : lignes brutes « Authentication-Results: … » dans l'ordre du message (la première est la plus récente). */
export function expediteurAuthentifie(headerLines: string[], adresseDe: string): boolean {
  const domaine = domaineDe(adresseDe);
  if (!domaine || !adresseDe.includes("@")) return false;
  const premiere = headerLines
    .map((l) => l.replace(/^authentication-results\s*:/i, "").replace(/\r?\n[ \t]+/g, " ").trim())
    .find((l) => l.split(";")[0].trim().split(/\s+/)[0].toLowerCase() === SERVEUR_DE_CONFIANCE);
  if (!premiere) return false;
  const [, ...resultats] = sansCommentaires(premiere).split(";");
  for (const brut of resultats) {
    const jetons = brut.trim().split(/\s+/).filter(Boolean);
    const [methode, resultat] = (jetons[0] ?? "").toLowerCase().split("=");
    if (resultat !== "pass") continue;
    const props = new Map(jetons.slice(1).map((j) => {
      const i = j.indexOf("=");
      return [j.slice(0, i).toLowerCase(), j.slice(i + 1)] as const;
    }));
    if (methode === "dmarc" && aligne(domaineDe(props.get("header.from")), domaine)) return true;
    if (methode === "dkim" && (aligne(domaineDe(props.get("header.d")), domaine) || aligne(domaineDe(props.get("header.i")), domaine))) return true;
    if (methode === "spf" && aligne(domaineDe(props.get("smtp.mailfrom")), domaine)) return true;
  }
  return false;
}
