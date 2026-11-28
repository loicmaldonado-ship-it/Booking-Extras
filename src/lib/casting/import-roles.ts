// Import de rôles de casting depuis un fichier CSV (dépouillement d'un
// scénario) : une ligne = un rôle. Ce fichier ne contient que de la logique
// pure (lecture du CSV, nom, catégorie, message) — il sert à l'aperçu côté
// navigateur comme à la création côté serveur, sans accès à la base.
import type { CategorieCachet } from "./types";

export type LigneImport = {
  // Numéro de la ligne dans le tableur (la première ligne du fichier = 1).
  ligne: number;
  episode: string;
  role: string;
  // « Épisode · Rôle » : le nom doit être unique par projet.
  nom: string;
  categorieSource: string;
  categorie: CategorieCachet | null;
  // null = pas de message personnalisé : le message automatique est utilisé.
  messageCorps: string | null;
  // Fiche vue par les agents : profil, âge, séquence, répliques (colonnes du fichier).
  agents: { description: string | null; age: string | null; sequence: string | null; repliques: string | null };
  // « ok » : sera créé. Sinon la ligne est écartée, avec la raison.
  etat: "ok" | "doublon_fichier" | "doublon_projet" | "ignoree";
  raison?: string;
};

export type AnalyseImport = { lignes: LigneImport[]; erreur?: string };

export const IMPORT_TAILLE_MAX = 1_000_000; // octets de texte, large pour un dépouillement

// Seules ces quatre catégories du fichier sont reconnues.
const CATEGORIES: Record<string, CategorieCachet> = {
  "petit role": "role",
  voix: "role",
  "silhouette parlante": "silhouette",
  silhouette: "silhouette",
};

// Sans accents, minuscules, espaces simples : sert à reconnaître les
// colonnes, les catégories et à comparer les noms.
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detecterSeparateur(texte: string): string {
  const ligneEntete = texte.split(/\r?\n/).find((l) => /pisode/i.test(l) && /r[oô]le/i.test(l));
  if (!ligneEntete) return ",";
  const compte = (c: string) => ligneEntete.split(c).length - 1;
  const candidats = [",", ";", "\t"].sort((a, b) => compte(b) - compte(a));
  return compte(candidats[0]) > 0 ? candidats[0] : ",";
}

// Lecture CSV standard : champs entre guillemets, guillemets doublés, retours
// à la ligne dans un champ (les répliques en contiennent).
export function lireCsv(texte: string, separateur: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else entreGuillemets = false;
      } else champ += c;
    } else if (c === '"' && champ === "") {
      entreGuillemets = true;
    } else if (c === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      champ = "";
      lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

// Message d'invitation du rôle : « Profil » et « Texte d'essai » seulement.
// Les colonnes Remarques, Propositions et Statut n'y entrent jamais — ce
// sont des notes internes. Le {lien} est indispensable : sans lui, le mail
// ne contiendrait pas le lien d'envoi de l'essai.
export function messageInvitation(profil: string, texteEssai: string): string | null {
  const p = profil.trim();
  const t = texteEssai.trim();
  if (!p && !t) return null;
  return [
    "Bonjour {prenom},",
    "",
    "L'équipe de casting du projet « {projet} » vous propose pour le rôle « {role} ».",
    ...(p ? ["", `Profil : ${p}`] : []),
    ...(t ? ["", "Texte d'essai :", t] : []),
    "",
    "Merci de nous envoyer votre essai via ce lien : {lien}",
  ].join("\n");
}

export function analyserCsv(texteBrut: string): AnalyseImport {
  const texte = texteBrut.replace(/^﻿/, "");
  if (texte.length > IMPORT_TAILLE_MAX) return { lignes: [], erreur: "Fichier trop volumineux pour un import de rôles." };

  const enregistrements = lireCsv(texte, detecterSeparateur(texte));

  // Les premières lignes (compteurs, ligne vide) sont ignorées : la ligne
  // d'en-tête est la première qui nomme les colonnes « Épisode » et « Rôle »
  // (dans l'export fourni, c'est la 3e).
  const indexEntete = enregistrements.slice(0, 10).findIndex((r) => {
    const cellules = r.map(normaliser);
    return cellules.includes("episode") && cellules.includes("role");
  });
  if (indexEntete === -1) {
    return { lignes: [], erreur: "Colonnes « Épisode » et « Rôle » introuvables dans les premières lignes du fichier." };
  }

  const entete = enregistrements[indexEntete].map(normaliser);
  const col = (nom: string) => entete.indexOf(nom);
  const cEpisode = col("episode");
  const cRole = col("role");
  const cCategorie = col("categorie");
  const cProfil = col("profil");
  const cAge = col("age");
  const cSeq = entete.findIndex((c) => c.startsWith("seq"));
  const cTexte = entete.findIndex((c) => c.startsWith("texte d'essai") || c.startsWith("texte d’essai"));
  if (cCategorie === -1) return { lignes: [], erreur: "Colonne « Catégorie » introuvable dans le fichier." };

  const lignes: LigneImport[] = [];
  const vus = new Map<string, number>(); // nom normalisé -> numéro de ligne

  for (let i = indexEntete + 1; i < enregistrements.length; i++) {
    const r = enregistrements[i];
    const valeur = (c: number) => (c >= 0 ? (r[c] ?? "").trim() : "");
    const episode = valeur(cEpisode);
    const role = valeur(cRole);
    const categorieSource = valeur(cCategorie);
    // Ligne entièrement vide (ex. fin de fichier) : rien à signaler.
    if (r.every((v) => !v.trim())) continue;

    const base = { ligne: i + 1, episode, role, nom: `${episode} · ${role}`, categorieSource, messageCorps: null, agents: { description: null, age: null, sequence: null, repliques: null } };
    if (!episode || !role) {
      lignes.push({ ...base, categorie: null, etat: "ignoree", raison: "Épisode ou rôle manquant." });
      continue;
    }
    const categorie = CATEGORIES[normaliser(categorieSource)] ?? null;
    if (!categorie) {
      lignes.push({
        ...base,
        categorie: null,
        etat: "ignoree",
        raison: categorieSource ? `Catégorie « ${categorieSource} » non reconnue.` : "Catégorie manquante.",
      });
      continue;
    }
    const cle = normaliser(base.nom);
    const dejaVu = vus.get(cle);
    if (dejaVu !== undefined) {
      lignes.push({ ...base, categorie, etat: "doublon_fichier", raison: `Même nom qu'à la ligne ${dejaVu}.` });
      continue;
    }
    vus.set(cle, base.ligne);
    lignes.push({
      ...base,
      categorie,
      messageCorps: messageInvitation(valeur(cProfil), valeur(cTexte)),
      agents: {
        description: valeur(cProfil) || null,
        age: valeur(cAge) || null,
        sequence: valeur(cSeq) || null,
        repliques: valeur(cTexte) || null,
      },
      etat: "ok",
    });
  }
  return { lignes };
}

// Écarte les lignes dont le nom existe déjà sur le projet.
export function marquerDoublonsProjet(lignes: LigneImport[], nomsExistants: string[]): LigneImport[] {
  const existants = new Set(nomsExistants.map(normaliser));
  return lignes.map((l) =>
    l.etat === "ok" && existants.has(normaliser(l.nom))
      ? { ...l, etat: "doublon_projet", raison: "Un rôle de ce nom existe déjà sur ce projet." }
      : l
  );
}
