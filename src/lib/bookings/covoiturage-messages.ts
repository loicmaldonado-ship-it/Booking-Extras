import { mailtoHref } from "./convocation";

export function smsHref(telephone: string, body: string) {
  const cleaned = telephone.replace(/\s+/g, "");
  return `sms:${encodeURIComponent(cleaned)}?&body=${encodeURIComponent(body)}`;
}

// Ouvre directement le fil de conversation existant avec ce numéro, sans
// pré-remplir de texte (contrairement à smsHref, utilisé pour les envois).
export function smsConversationHref(telephone: string) {
  const cleaned = telephone.replace(/\s+/g, "");
  return `sms:${encodeURIComponent(cleaned)}`;
}

export function openHref(href: string) {
  window.location.href = href;
}

type Contact = { prenom: string; nom: string; telephone: string | null; email: string | null };

export function buildChauffeurMessage(params: {
  prenom: string;
  lieu: string | null;
  date: string;
  heure: string | null;
  passagers: Contact[];
}) {
  const { prenom, lieu, date, heure, passagers } = params;
  const noms = passagers.map((p) => `${p.prenom} ${p.nom}`).join(" et ");
  const contacts = passagers
    .filter((p) => p.telephone)
    .map((p) => `${p.prenom} : ${p.telephone}`)
    .join(", ");

  return [
    `Bonjour ${prenom},`,
    `vous conduisez ${noms || "personne pour l'instant"} le ${date}${heure ? ` (RDV ${heure})` : ""}.`,
    `On se retrouve à : ${lieu ?? "lieu à confirmer"}.`,
    ...(contacts ? [`Contacts : ${contacts}.`] : []),
    "Merci !",
  ].join("\n");
}

export function buildPassagerMessage(params: {
  prenom: string;
  lieu: string | null;
  date: string;
  heure: string | null;
  chauffeur: Contact;
}) {
  const { prenom, lieu, date, heure, chauffeur } = params;

  return [
    `Bonjour ${prenom},`,
    `votre covoiturage du ${date}${heure ? ` (RDV ${heure})` : ""} est avec ${chauffeur.prenom} ${chauffeur.nom}` +
      (chauffeur.telephone ? ` (${chauffeur.telephone})` : "") +
      ".",
    `On se retrouve à : ${lieu ?? "lieu à confirmer"}.`,
    "Merci !",
  ].join("\n");
}

export function contactHref(contact: Contact, body: string, subject: string) {
  if (contact.telephone) return { kind: "sms" as const, href: smsHref(contact.telephone, body) };
  if (contact.email) return { kind: "email" as const, href: mailtoHref(contact.email, subject, body) };
  return null;
}
