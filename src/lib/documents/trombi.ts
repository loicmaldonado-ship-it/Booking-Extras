import { formatHeureConvocation } from "./fields";
import type { ConfirmedBooking } from "./data";
import { sortBookingsFlat, type DocSort } from "./sort";

// Ordre d'affichage voulu sur les trombis : silhouettes, puis doublures, puis figurants en dernier.
export const TROMBI_CACHET_ORDER = [
  "Silhouette",
  "Silhouette parlante",
  "Doublure simple",
  "Doublure polyvalente",
  "Rôle",
  "Figurant",
];

function cachetOrder(cachet: string | null) {
  const idx = cachet ? TROMBI_CACHET_ORDER.indexOf(cachet) : -1;
  return idx === -1 ? TROMBI_CACHET_ORDER.length : idx;
}

function nomSort(a: ConfirmedBooking, b: ConfirmedBooking) {
  return `${a.figurant.prenom} ${a.figurant.nom}`.localeCompare(`${b.figurant.prenom} ${b.figurant.nom}`);
}

// Ordre par défaut (aucun tri additif choisi) : heure, puis cachet dans
// l'ordre de priorité de production, puis fonction si affichée, puis nom.
function defaultOrder(bookings: ConfirmedBooking[], sortByFonction: boolean): ConfirmedBooking[] {
  const byHeure = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = b.heure_convocation ?? "";
    const list = byHeure.get(key) ?? [];
    list.push(b);
    byHeure.set(key, list);
  }

  const out: ConfirmedBooking[] = [];
  for (const [, group] of Array.from(byHeure.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const byCachet = new Map<string, ConfirmedBooking[]>();
    for (const b of group) {
      const key = b.cachet ?? "";
      const list = byCachet.get(key) ?? [];
      list.push(b);
      byCachet.set(key, list);
    }
    const cachetGroups = Array.from(byCachet.entries()).sort(
      (a, b) => cachetOrder(a[1][0]?.cachet ?? null) - cachetOrder(b[1][0]?.cachet ?? null)
    );
    for (const [, sousGroup] of cachetGroups) {
      const sorted = sortByFonction
        ? [...sousGroup].sort((a, b) => (a.fonction ?? "").localeCompare(b.fonction ?? "") || nomSort(a, b))
        : [...sousGroup].sort(nomSort);
      out.push(...sorted);
    }
  }
  return out;
}

export type TrombiItem = { booking: ConfirmedBooking; headerLabel: string };

// La ligne d'en-tête au-dessus d'un bloc de photos reste toujours
// "Cachet · Heure de convocation", quel que soit le tri additif choisi —
// c'est un repère fixe, indépendant de l'ordre d'affichage.
function headerLabelOf(b: ConfirmedBooking): string {
  const cachet = b.cachet ?? "Cachet non assigné";
  const heure = b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "Heure non renseignée";
  return `${cachet} · ${heure}`;
}

export function buildTrombiItems(
  bookings: ConfirmedBooking[],
  docSort: DocSort,
  sortByFonction: boolean
): TrombiItem[] {
  const ordered = docSort.length > 0 ? sortBookingsFlat(bookings, docSort) : defaultOrder(bookings, sortByFonction);
  return ordered.map((booking) => ({ booking, headerLabel: headerLabelOf(booking) }));
}
