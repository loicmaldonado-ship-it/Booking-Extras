import localFont from "next/font/local";
import type { AffichePolice, AffichePoliceCorps } from "@/lib/annonces/affiche";

// Mêmes fichiers que ceux de l'affiche générée, pour que chaque choix de
// police s'affiche dans sa propre police. Pas préchargées : seule la page
// de modification d'une annonce les utilise.
const spaceGrotesk = localFont({ src: "../../app/fonts/SpaceGrotesk-700.ttf", preload: false, display: "swap" });
const bebasNeue = localFont({ src: "../../app/fonts/BebasNeue-400.ttf", preload: false, display: "swap" });
const playfair = localFont({ src: "../../app/fonts/PlayfairDisplay-700.ttf", preload: false, display: "swap" });
const archivoBlack = localFont({ src: "../../app/fonts/ArchivoBlack-400.ttf", preload: false, display: "swap" });
const caveat = localFont({ src: "../../app/fonts/Caveat-700.ttf", preload: false, display: "swap" });
const spaceGroteskCorps = localFont({ src: "../../app/fonts/SpaceGrotesk-500.ttf", preload: false, display: "swap" });
const playfairCorps = localFont({ src: "../../app/fonts/PlayfairDisplay-400.ttf", preload: false, display: "swap" });
const archivo = localFont({ src: "../../app/fonts/Archivo-400.ttf", preload: false, display: "swap" });

export const AFFICHE_FONT_CLASS: Record<AffichePolice, string> = {
  "space-grotesk": spaceGrotesk.className,
  "bebas-neue": bebasNeue.className,
  playfair: playfair.className,
  "archivo-black": archivoBlack.className,
  caveat: caveat.className,
};

export const AFFICHE_FONT_CORPS_CLASS: Record<AffichePoliceCorps, string> = {
  "space-grotesk": spaceGroteskCorps.className,
  playfair: playfairCorps.className,
  archivo: archivo.className,
  caveat: caveat.className,
};
