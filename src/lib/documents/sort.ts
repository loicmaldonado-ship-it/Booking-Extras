import { computeAge } from "./fields";
import type { ConfirmedBooking } from "./data";

// Tri additif : chaque critère cliqué s'ajoute à la liste, dans l'ordre de
// clic — le premier critère groupe en premier, le second affine chaque
// groupe, etc. Liste vide = ordre par défaut de la page (heure, date...).
export type Dimension = "fonction" | "cachet" | "sexe" | "age";
export type DocSort = Dimension[];

export const SORT_DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "fonction", label: "Fonction" },
  { key: "cachet", label: "Cachet" },
  { key: "sexe", label: "Genre" },
  { key: "age", label: "Âge" },
];

const VALID_DIMENSIONS = new Set(SORT_DIMENSIONS.map((d) => d.key));

export function parseDocSort(v: string | string[] | undefined): DocSort {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const dims: Dimension[] = [];
  for (const item of list) {
    if (VALID_DIMENSIONS.has(item as Dimension) && !dims.includes(item as Dimension)) {
      dims.push(item as Dimension);
    }
  }
  return dims;
}

export function ageBracket(dateNaissance: string | null): string {
  const age = computeAge(dateNaissance);
  if (age === null) return "Âge non renseigné";
  if (age < 18) return "- 18 ans";
  if (age <= 30) return "18-30 ans";
  if (age <= 50) return "31-50 ans";
  return "51 ans +";
}

// Regroupe des items selon une liste ordonnée de dimensions, via des
// fonctions fournies par l'appelant (les champs disponibles diffèrent entre
// bookings et candidatures). Retourne null si aucun tri n'est demandé —
// l'appelant garde alors son ordre par défaut.
export function groupByDimensions<T>(
  items: T[],
  sort: DocSort,
  labelFor: (item: T, dim: Dimension) => string,
  nameOf: (item: T) => string
): { label: string; items: T[] }[] | null {
  if (sort.length === 0) return null;

  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = sort.map((dim) => labelFor(item, dim)).join(" · ");
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, groupItems]) => ({
      label,
      items: [...groupItems].sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    }));
}

function dimensionLabel(b: ConfirmedBooking, dim: Dimension): string {
  if (dim === "fonction") return b.fonction ?? "Sans fonction";
  if (dim === "cachet") return b.cachet ?? "Sans cachet";
  if (dim === "sexe") return b.figurant.genre ?? "Non renseigné";
  return ageBracket(b.figurant.date_naissance);
}

function nomOf(b: ConfirmedBooking) {
  return `${b.figurant.prenom} ${b.figurant.nom}`;
}

export function groupForDoc(
  bookings: ConfirmedBooking[],
  sort: DocSort
): { label: string; items: ConfirmedBooking[] }[] | null {
  return groupByDimensions(bookings, sort, dimensionLabel, nomOf);
}

export function sortBookingsFlat(bookings: ConfirmedBooking[], sort: DocSort): ConfirmedBooking[] {
  const groups = groupForDoc(bookings, sort);
  if (!groups) return bookings;
  return groups.flatMap((g) => g.items);
}
