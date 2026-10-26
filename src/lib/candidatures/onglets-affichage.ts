import type { CandidatureOnglet } from "./types";

export const sansAccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Pictogramme d'un onglet, d'après son nom (onglets communs posés par la
// migration : Retenu, Peut-être, OUT ; les journées ont le leur, les autres
// sont perso).
export function emojiOnglet(o: Pick<CandidatureOnglet, "nom" | "fixe"> & { annonce_date_id?: string | null }): string {
  if (o.fixe) return "🚫";
  if (o.annonce_date_id) return "📅";
  const n = sansAccent(o.nom);
  if (n.startsWith("retenu")) return "✅";
  if (n.startsWith("peut")) return "🤔";
  return "🗂️";
}

// Les trois boutons de rangement rapide sous chaque photo.
export function ongletsRapides(onglets: CandidatureOnglet[]) {
  const commun = (test: (n: string) => boolean) =>
    onglets.find((o) => !o.fixe && o.annonce_id === null && test(sansAccent(o.nom))) ??
    onglets.find((o) => !o.fixe && test(sansAccent(o.nom))) ??
    null;
  return {
    retenu: commun((n) => n.startsWith("retenu")),
    peutEtre: commun((n) => n.startsWith("peut")),
    out: onglets.find((o) => o.fixe) ?? null,
  };
}
