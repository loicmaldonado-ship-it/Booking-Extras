// Styles d'affiche d'annonce, partagés entre le formulaire (choix + aperçu)
// et la génération de l'image (src/app/annonces/[id]/poster/route.tsx).

export type AffichePolice = "space-grotesk" | "bebas-neue" | "playfair" | "archivo-black" | "caveat";

// Mesures du titre par police : la hauteur de l'affiche est calculée avant
// le rendu (Satori ne s'ajuste pas tout seul), donc il faut savoir combien
// de caractères tiennent sur une ligne de la colonne de texte (~788px).
export const AFFICHE_POLICES: {
  key: AffichePolice;
  label: string;
  description: string;
  fichier: string;
  titreTaille: number;
  titreInterligne: number;
  titreCaracteresParLigne: number;
  majuscules?: boolean;
}[] = [
  { key: "space-grotesk", label: "Space Grotesk", description: "Moderne, la police du site", fichier: "SpaceGrotesk-700.ttf", titreTaille: 56, titreInterligne: 1.15, titreCaracteresParLigne: 24 },
  { key: "bebas-neue", label: "Bebas Neue", description: "Affiche de cinéma", fichier: "BebasNeue-400.ttf", titreTaille: 76, titreInterligne: 1.0, titreCaracteresParLigne: 26, majuscules: true },
  { key: "playfair", label: "Playfair Display", description: "Élégante", fichier: "PlayfairDisplay-700.ttf", titreTaille: 56, titreInterligne: 1.15, titreCaracteresParLigne: 24 },
  { key: "archivo-black", label: "Archivo Black", description: "Publicitaire, très grasse", fichier: "ArchivoBlack-400.ttf", titreTaille: 52, titreInterligne: 1.15, titreCaracteresParLigne: 20 },
  { key: "caveat", label: "Caveat", description: "Manuscrite", fichier: "Caveat-700.ttf", titreTaille: 68, titreInterligne: 1.1, titreCaracteresParLigne: 28 },
];

// Polices du corps (infos + description) : seulement des polices lisibles
// en paragraphe. caracteresParLigne = à 22px dans la colonne de texte,
// facteur = agrandissement pour une lisibilité équivalente (Caveat est
// petite à taille égale).
export type AffichePoliceCorps = "space-grotesk" | "playfair" | "archivo" | "caveat";

export const AFFICHE_POLICES_CORPS: {
  key: AffichePoliceCorps;
  label: string;
  description: string;
  fichier: string;
  facteur: number;
  caracteresParLigne: number;
}[] = [
  { key: "space-grotesk", label: "Space Grotesk", description: "Moderne, la police du site", fichier: "SpaceGrotesk-500.ttf", facteur: 1, caracteresParLigne: 62 },
  { key: "playfair", label: "Playfair Display", description: "Élégante", fichier: "PlayfairDisplay-400.ttf", facteur: 1, caracteresParLigne: 64 },
  { key: "archivo", label: "Archivo", description: "Sobre et nette", fichier: "Archivo-400.ttf", facteur: 1, caracteresParLigne: 58 },
  { key: "caveat", label: "Caveat", description: "Manuscrite", fichier: "Caveat-700.ttf", facteur: 1.3, caracteresParLigne: 84 },
];

export type AfficheTaille = "normal" | "grand" | "tres-grand";

export const AFFICHE_TAILLES: { key: AfficheTaille; label: string; echelle: number }[] = [
  { key: "normal", label: "Normal", echelle: 1 },
  { key: "grand", label: "Grand", echelle: 1.2 },
  { key: "tres-grand", label: "Très grand", echelle: 1.4 },
];

export type AfficheFormat = "carre" | "story";

export const AFFICHE_COULEURS: { hex: string; label: string }[] = [
  { hex: "#111111", label: "Noir" },
  { hex: "#1F2A44", label: "Bleu nuit" },
  { hex: "#3D5A40", label: "Vert sauge" },
  { hex: "#6B2737", label: "Bordeaux" },
  { hex: "#E8734A", label: "Corail" },
  { hex: "#F2E8D5", label: "Crème" },
];

// Couleurs proposées pour le titre, en plus de « Auto » (blanc ou noir
// selon le fond) et d'une couleur libre.
export const AFFICHE_COULEURS_TITRE: { hex: string; label: string }[] = [
  { hex: "#FFFFFF", label: "Blanc" },
  { hex: "#141414", label: "Noir" },
  { hex: "#F2E8D5", label: "Crème" },
  { hex: "#F5A47A", label: "Pêche" },
  { hex: "#E8734A", label: "Corail" },
  { hex: "#F2C14E", label: "Jaune doré" },
];

export function normalizeAffichePolice(v: unknown): AffichePolice | null {
  return AFFICHE_POLICES.some((p) => p.key === v) ? (v as AffichePolice) : null;
}

export function normalizeAffichePoliceCorps(v: unknown): AffichePoliceCorps | null {
  return AFFICHE_POLICES_CORPS.some((p) => p.key === v) ? (v as AffichePoliceCorps) : null;
}

export function normalizeAfficheTaille(v: unknown): AfficheTaille | null {
  return AFFICHE_TAILLES.some((t) => t.key === v) ? (v as AfficheTaille) : null;
}

export function normalizeAfficheFormat(v: unknown): AfficheFormat {
  return v === "story" ? "story" : "carre";
}

export function affichePoliceCorps(key: string | null | undefined) {
  return AFFICHE_POLICES_CORPS.find((p) => p.key === key) ?? AFFICHE_POLICES_CORPS[0];
}

export function afficheTaille(key: string | null | undefined) {
  return AFFICHE_TAILLES.find((t) => t.key === key) ?? AFFICHE_TAILLES[0];
}

export function normalizeAfficheCouleur(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}

export function affichePolice(key: string | null | undefined) {
  return AFFICHE_POLICES.find((p) => p.key === key) ?? AFFICHE_POLICES[0];
}

function canaux(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = canaux(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Texte blanc ou presque noir selon la clarté de la couleur choisie, pour
// qu'une couleur claire (crème) reste lisible.
function texteLisible(hex: string): string {
  return luminance(hex) > 0.4 ? "#141414" : "#FFFFFF";
}

// Contraste WCAG entre un texte et le bas de l'affiche (le voile, de la
// couleur du fond ; presque noir pour le style d'origine). Lisible si
// ≥ 4,5 pour un paragraphe, ≥ 3 pour un gros titre.
export function afficheContraste(texte: string, fond: string | null): number {
  const a = luminance(texte);
  const b = luminance(fond ?? "#0A0A0A");
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// null = style d'origine de l'affiche, inchangé pour les annonces existantes.
export function afficheCouleurs(couleur: string | null) {
  if (!couleur) {
    return {
      fond: "#E8734A",
      voile: "rgba(10,10,10,0.94)",
      texte: "#FFFFFF",
      texteDoux: "#D8D8D8",
      accent: "#F5A47A",
    };
  }
  const [r, g, b] = canaux(couleur);
  const texte = texteLisible(couleur);
  const sombre = texte === "#FFFFFF";
  return {
    fond: couleur,
    voile: `rgba(${r},${g},${b},0.95)`,
    texte,
    texteDoux: sombre ? "rgba(255,255,255,0.86)" : "rgba(20,20,20,0.82)",
    accent: sombre ? "rgba(255,255,255,0.72)" : "rgba(20,20,20,0.66)",
  };
}
