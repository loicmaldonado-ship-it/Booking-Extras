import { mailtoHref, DEFAULT_SIGNATURE } from "@/lib/bookings/convocation";

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

type EssayageMessageParams = {
  figurantPrenom: string;
  figurantEmail: string;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  projetNom: string;
  signature: string | null;
  consigne?: string;
  numeroCostume?: string | null;
};

export function buildEssayagePropositionMailto(params: EssayageMessageParams) {
  const { figurantPrenom, figurantEmail, date, heure, lieu, projetNom, signature } = params;

  const quand = date ? `le ${formatDateFr(date)}${heure ? ` à ${formatHeure(heure)}` : ""}` : "prochainement (date à définir)";

  const lines = [
    `Bonjour ${figurantPrenom},`,
    "",
    `nous vous proposons un essayage costume pour '${projetNom}' ${quand}`,
    lieu ? `à l'adresse suivante : ${lieu}` : "lieu à confirmer",
    "",
    "Merci de nous confirmer votre disponibilité par retour de message.",
    "",
    signature?.trim() || DEFAULT_SIGNATURE,
  ];

  const subject = `Proposition essayage – ${projetNom}`;
  const body = lines.join("\n");
  return { href: mailtoHref(figurantEmail, subject, body), subject, body };
}

export function buildEssayageConfirmationMailto(params: EssayageMessageParams) {
  const { figurantPrenom, figurantEmail, date, heure, lieu, projetNom, signature, consigne, numeroCostume } = params;

  const quand = date ? `le ${formatDateFr(date)}${heure ? ` à ${formatHeure(heure)}` : ""}` : "à une date à confirmer";

  const lines = [
    `Bonjour ${figurantPrenom},`,
    "",
    `votre essayage costume pour '${projetNom}' est confirmé ${quand}`,
    lieu ? `à l'adresse suivante : ${lieu}` : "lieu à confirmer",
    ...(numeroCostume ? ["", `Votre numéro de costume : ${numeroCostume}`] : []),
    ...(consigne?.trim() ? ["", consigne.trim()] : []),
    "",
    "Merci de nous prévenir au plus vite en cas d'empêchement.",
    "",
    signature?.trim() || DEFAULT_SIGNATURE,
  ];

  const subject = `Confirmation essayage – ${projetNom}`;
  const body = lines.join("\n");
  return { href: mailtoHref(figurantEmail, subject, body), subject, body };
}
