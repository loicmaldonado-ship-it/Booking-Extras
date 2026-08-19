import type { Civilite, Figurant } from "@/lib/figurants/types";

// Calqué exactement sur le gabarit d'import Myrole fourni par l'utilisateur :
// mêmes en-têtes, même ordre, même délimiteur (point-virgule). Les colonnes
// RIB et sécu restent TOUJOURS vides — Booking Extras ne les collecte jamais,
// c'est le rôle de Myrole.
export const MYROLE_HEADERS = [
  "Acteur/Technicien",
  "Civilite *",
  "Prenom *",
  "Nom *",
  "Nom de naissance",
  "Email *",
  "Portable",
  "Date de naissance *",
  "No Securite sociale",
  "Qualification",
  "Emploi",
  "Nationalite",
  "Code du pays de naissance",
  "Commune de naissance *",
  "Code INSEE de la commune de naissance",
  "Situation",
  "Nombre d'enfants",
  "Nombre personnes à charge",
  "Intermittent (0-1)",
  "Retraite (0-1)",
  "Au chomage (0-1)",
  "Abattement (0-1)",
  "No conges spectacles",
  "Date derniere visite medicale",
  "Numero de rue",
  "Ext.",
  "Type de voie",
  "Adresse",
  "Complement d'adresse",
  "Code postal",
  "Code INSEE de la commune",
  "Bureau distributeur",
  "Pays",
  "No carte de sejour",
  "Date d'expiration du titre de sejour",
  "Beneficiaire 1",
  "Domiciliation bancaire 1",
  "BIC (ou SWIFT) 1",
  "IBAN 1",
  "Banque 1",
  "Guichet 1",
  "Compte 1",
  "Cle RIB 1",
] as const;

const CIVILITE_MYROLE: Record<Civilite, string> = {
  "M.": "Mr",
  Mme: "Mme",
  Autre: "",
};

function frenchDate(isoDate: string | null): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function csvField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function figurantToMyroleRow(f: Figurant): string[] {
  const row: Record<(typeof MYROLE_HEADERS)[number], string> = {
    "Acteur/Technicien": "Acteur",
    "Civilite *": f.civilite ? CIVILITE_MYROLE[f.civilite] : "",
    "Prenom *": f.prenom,
    "Nom *": f.nom,
    "Nom de naissance": "",
    "Email *": f.email ?? "",
    Portable: f.telephone ?? "",
    "Date de naissance *": frenchDate(f.date_naissance),
    "No Securite sociale": "",
    Qualification: "",
    Emploi: "",
    Nationalite: "",
    "Code du pays de naissance": "",
    "Commune de naissance *": f.commune_naissance ?? "",
    "Code INSEE de la commune de naissance": "",
    Situation: "",
    "Nombre d'enfants": "",
    "Nombre personnes à charge": "",
    "Intermittent (0-1)": "",
    "Retraite (0-1)": "",
    "Au chomage (0-1)": "",
    "Abattement (0-1)": "",
    "No conges spectacles": "",
    "Date derniere visite medicale": "",
    "Numero de rue": "",
    "Ext.": "",
    "Type de voie": "",
    Adresse: "",
    "Complement d'adresse": "",
    "Code postal": "",
    "Code INSEE de la commune": "",
    "Bureau distributeur": f.ville ?? "",
    Pays: "",
    "No carte de sejour": "",
    "Date d'expiration du titre de sejour": "",
    "Beneficiaire 1": "",
    "Domiciliation bancaire 1": "",
    "BIC (ou SWIFT) 1": "",
    "IBAN 1": "",
    "Banque 1": "",
    "Guichet 1": "",
    "Compte 1": "",
    "Cle RIB 1": "",
  };

  return MYROLE_HEADERS.map((h) => row[h]);
}

export function buildMyroleCsv(figurants: Figurant[]): string {
  const lines = [
    MYROLE_HEADERS.map(csvField).join(";"),
    ...figurants.map((f) => figurantToMyroleRow(f).map(csvField).join(";")),
  ];
  // BOM pour qu'Excel ouvre correctement les accents en UTF-8.
  return "﻿" + lines.join("\r\n");
}
