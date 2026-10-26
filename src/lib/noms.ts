// Règle du site pour les personnes : affichage « Prénom NOM » (ex. Loïc
// MALDONADO) et rangement par ordre alphabétique du nom, puis du prénom.

type Personne = { prenom?: string | null; nom?: string | null } | null | undefined;

// « jean-michel » / « JEAN-MICHEL » → « Jean-Michel ».
export function formatPrenom(prenom: string | null | undefined): string {
  return (prenom ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, lettre: string) => sep + lettre.toLocaleUpperCase("fr-FR"));
}

export function formatNom(nom: string | null | undefined): string {
  return (nom ?? "").trim().toLocaleUpperCase("fr-FR");
}

export function nomComplet(p: Personne): string {
  if (!p) return "";
  return [formatPrenom(p.prenom), formatNom(p.nom)].filter(Boolean).join(" ");
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

// Ordre alphabétique : nom, puis prénom (accents et majuscules ignorés).
export function comparerNoms(a: Personne, b: Personne): number {
  return collator.compare(a?.nom ?? "", b?.nom ?? "") || collator.compare(a?.prenom ?? "", b?.prenom ?? "");
}

// Trie une liste selon la personne de chaque élément (copie, stable).
export function trierParNom<T>(liste: readonly T[], personne: (item: T) => Personne): T[] {
  return [...liste].sort((a, b) => comparerNoms(personne(a), personne(b)));
}
