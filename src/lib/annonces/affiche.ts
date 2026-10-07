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

export const AFFICHE_COULEURS: { hex: string; label: string }[] = [
  { hex: "#111111", label: "Noir" },
  { hex: "#1F2A44", label: "Bleu nuit" },
  { hex: "#3D5A40", label: "Vert sauge" },
  { hex: "#6B2737", label: "Bordeaux" },
  { hex: "#E8734A", label: "Corail" },
  { hex: "#F2E8D5", label: "Crème" },
];

export function normalizeAffichePolice(v: unknown): AffichePolice | null {
  return AFFICHE_POLICES.some((p) => p.key === v) ? (v as AffichePolice) : null;
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

// Texte blanc ou presque noir selon la clarté de la couleur choisie, pour
// qu'une couleur claire (crème) reste lisible.
function texteLisible(hex: string): string {
  const [r, g, b] = canaux(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#141414" : "#FFFFFF";
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
