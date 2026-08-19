import { computeAge } from "./fields";
import type { ConfirmedBooking } from "./data";

export type DocSort =
  | "none"
  | "fonction"
  | "cachet"
  | "fonction+cachet"
  | "fonction+age"
  | "sexe"
  | "age";

const VALID_SORTS: DocSort[] = ["none", "fonction", "cachet", "fonction+cachet", "fonction+age", "sexe", "age"];

export function parseDocSort(v: string | undefined): DocSort {
  return (VALID_SORTS as string[]).includes(v ?? "") ? (v as DocSort) : "none";
}

export const DOC_SORT_OPTIONS: { key: DocSort; label: string }[] = [
  { key: "none", label: "Par défaut (heure)" },
  { key: "fonction", label: "Fonction" },
  { key: "cachet", label: "Cachet" },
  { key: "fonction+cachet", label: "Fonction + Cachet" },
  { key: "fonction+age", label: "Fonction + Âge" },
  { key: "sexe", label: "Genre" },
  { key: "age", label: "Âge" },
];

type Dimension = "fonction" | "cachet" | "sexe" | "age";

function ageBracket(dateNaissance: string | null): string {
  const age = computeAge(dateNaissance);
  if (age === null) return "Âge non renseigné";
  if (age < 18) return "- 18 ans";
  if (age <= 30) return "18-30 ans";
  if (age <= 50) return "31-50 ans";
  return "51 ans +";
}

function dimensionLabel(b: ConfirmedBooking, dim: Dimension): string {
  if (dim === "fonction") return b.fonction ?? "Sans fonction";
  if (dim === "cachet") return b.cachet ?? "Sans cachet";
  if (dim === "sexe") return b.figurant.genre ?? "Non renseigné";
  return ageBracket(b.figurant.date_naissance);
}

function primaryDim(sort: DocSort): Dimension | null {
  switch (sort) {
    case "fonction":
    case "fonction+cachet":
    case "fonction+age":
      return "fonction";
    case "cachet":
      return "cachet";
    case "sexe":
      return "sexe";
    case "age":
      return "age";
    default:
      return null;
  }
}

function secondaryDim(sort: DocSort): Dimension | null {
  if (sort === "fonction+cachet") return "cachet";
  if (sort === "fonction+age") return "age";
  return null;
}

function nomSort(a: ConfirmedBooking, b: ConfirmedBooking) {
  return `${a.figurant.prenom} ${a.figurant.nom}`.localeCompare(`${b.figurant.prenom} ${b.figurant.nom}`);
}

// Retourne des groupes ordonnés selon le tri choisi (repris du dernier
// groupement actif dans BookingsTable), ou null si aucun tri n'est demandé —
// dans ce cas l'appelant garde son ordre par défaut (heure de convocation).
export function groupForDoc(
  bookings: ConfirmedBooking[],
  sort: DocSort
): { label: string; items: ConfirmedBooking[] }[] | null {
  const dim = primaryDim(sort);
  if (!dim) return null;
  const sec = secondaryDim(sort);

  const map = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = sec ? `${dimensionLabel(b, dim)} · ${dimensionLabel(b, sec)}` : dimensionLabel(b, dim);
    const list = map.get(key) ?? [];
    list.push(b);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, items]) => ({ label, items: [...items].sort(nomSort) }));
}

export function sortBookingsFlat(bookings: ConfirmedBooking[], sort: DocSort): ConfirmedBooking[] {
  const groups = groupForDoc(bookings, sort);
  if (!groups) return bookings;
  return groups.flatMap((g) => g.items);
}
