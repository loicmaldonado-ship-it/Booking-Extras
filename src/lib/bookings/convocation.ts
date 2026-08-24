function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateFr(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const weekday = capitalize(d.toLocaleDateString("fr-FR", { weekday: "long" }));
  const month = capitalize(d.toLocaleDateString("fr-FR", { month: "long" }));
  return `${weekday} ${d.getDate()} ${month}`;
}

function formatHeure(heure: string) {
  const [h, m] = heure.slice(0, 5).split(":");
  return `${h}H${m}`;
}

export function mailtoHref(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openMailto(href: string) {
  window.location.href = href;
}

// Templates use literal tokens so a single draft can be filled in per
// recipient (one at a time for a single row, or one substitution per send
// for a bulk selection).
export function substitutePrenom(text: string, prenom: string) {
  return text.replaceAll("{prenom}", prenom);
}

export function substituteTokens(
  text: string,
  tokens: Partial<Record<"prenom" | "projet" | "date" | "lieu" | "cachet" | "fonction" | "signature" | "role", string>>
) {
  let result = text;
  for (const [key, value] of Object.entries(tokens)) {
    if (value !== undefined) result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// Utilisée quand un projet n'a pas encore de signature configurée
// (Projet > Signature).
export const DEFAULT_SIGNATURE = [
  "Loïc MALDONADO ACFDA",
  "Chargé de Casting Rôle & Figuration",
  "06 59 04 98 36",
].join("\n");

// Valeurs par défaut des blocs calibrables de la convocation (Précisions,
// HMC, Commentaires) — reprennent le texte historique tel quel, pour que les
// journées qui n'ont rien personnalisé gardent exactement le même message.
export const DEFAULT_CONVOCATION_PRECISIONS = [
  "Rdv directement sur le décor !",
  "",
  "Sur place vous pourrez contacter : [à compléter]",
].join("\n");

export const DEFAULT_CONVOCATION_HMC = [
  "Merci de prendre les tenues vues avec l'équipe costume.",
  "",
  "Merci de venir bien coiffé·es, barbe rasée à blanc ou bien taillée, maquillage de jour élégant.",
].join("\n");

export const DEFAULT_CONVOCATION_COMMENTAIRES =
  "Nous avons à cœur de faire attention à la bienveillance entre les figurants, comédiens et les membres " +
  "de l'équipe technique. Si vous êtes victime ou témoin d'un comportement déplacé de la part d'une " +
  "personne sur le tournage, merci de nous en faire part.";

export type ConvocationSettings = {
  precisions?: string | null;
  hmc?: string | null;
  accessoires?: string | null;
  commentaires?: string | null;
};

export function buildConvocationMailto(params: {
  figurantPrenom: string;
  figurantEmail: string;
  date: string;
  heureConvocation: string | null;
  fonction: string | null;
  lieu: string | null;
  projetNom: string;
  confidentiel: boolean;
  nomCode?: string | null;
  signature: string | null;
  covoiturageInfo?: string | null;
  numeroCostume?: string | null;
  convocationSettings?: ConvocationSettings | null;
}) {
  const {
    figurantPrenom,
    figurantEmail,
    date,
    heureConvocation,
    fonction,
    lieu,
    projetNom,
    confidentiel,
    nomCode,
    signature,
    covoiturageInfo,
    numeroCostume,
    convocationSettings,
  } = params;

  const tournage = confidentiel
    ? nomCode
      ? `le tournage sur '${nomCode}'`
      : "notre tournage"
    : `le tournage sur '${projetNom}'`;
  const heure = heureConvocation ? `${formatHeure(heureConvocation)} précises` : "une heure à confirmer";

  const precisions = convocationSettings?.precisions?.trim() || DEFAULT_CONVOCATION_PRECISIONS;
  const hmc = convocationSettings?.hmc?.trim() || DEFAULT_CONVOCATION_HMC;
  const accessoires = convocationSettings?.accessoires?.trim();
  const commentaires = convocationSettings?.commentaires?.trim() || DEFAULT_CONVOCATION_COMMENTAIRES;

  const lines = [
    `Bonjour ${figurantPrenom},`,
    `la convocation pour ${tournage} le ${formatDateFr(date)} est à ${heure}`,
    "à l'adresse suivante :",
    lieu ?? "à confirmer",
    "",
    precisions,
    "",
    hmc,
    "",
    ...(accessoires ? [`Accessoires : ${accessoires}`, ""] : []),
    `Pour rappel votre fonction est : ${fonction ?? "à confirmer"}`,
    "",
    ...(numeroCostume ? [`Votre numéro de costume : ${numeroCostume}`, ""] : []),
    ...(covoiturageInfo ? [covoiturageInfo, ""] : []),
    commentaires,
    "",
    "MERCI D'ACCUSER RÉCEPTION AVEC VOTRE NOM PRÉNOM.",
    "À bientôt.",
    "",
    signature?.trim() || DEFAULT_SIGNATURE,
  ];

  const subject = confidentiel
    ? `Convocation tournage – ${date}`
    : `Convocation ${projetNom} – ${date}`;
  const body = lines.join("\n");

  return { href: mailtoHref(figurantEmail, subject, body), subject, body };
}
