import { formatHeureConvocation } from "./fields";
import type { ConfirmedBooking } from "./data";
import { ageBracket, type Dimension, type DocSort } from "./sort";

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

function nomOf(b: ConfirmedBooking) {
  return `${b.figurant.prenom} ${b.figurant.nom}`;
}

function nomSort(a: ConfirmedBooking, b: ConfirmedBooking) {
  return nomOf(a).localeCompare(nomOf(b));
}

function dimensionLabel(b: ConfirmedBooking, dim: Dimension): string {
  if (dim === "fonction") return b.fonction ?? "Sans fonction";
  if (dim === "cachet") return b.cachet ?? "Sans cachet";
  if (dim === "sexe") return b.figurant.genre ?? "Non renseigné";
  if (dim === "heure") return b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "Heure non renseignée";
  return ageBracket(b.figurant.date_naissance);
}

export type TrombiItem = { booking: ConfirmedBooking; headerLabel: string | null };

// Aucun tri choisi : liste simple triée par nom, sans regroupement ni
// en-tête imposé — on n'invente pas un découpage par défaut.
function flatByName(bookings: ConfirmedBooking[]): TrombiItem[] {
  return [...bookings].sort(nomSort).map((booking) => ({ booking, headerLabel: null }));
}

// Tri additif : un seul en-tête par combinaison de dimensions choisies, quel
// que soit l'éclatement des AUTRES critères — une silhouette bookée à 8h et
// une autre à 15h se retrouvent dans le même groupe "Silhouette" si seul le
// cachet est trié, pour maximiser le regroupement (et donc minimiser les
// pages) plutôt que fragmenter par heure.
export function buildTrombiItems(bookings: ConfirmedBooking[], docSort: DocSort): TrombiItem[] {
  if (docSort.length === 0) return flatByName(bookings);

  const map = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = docSort.map((d) => dimensionLabel(b, d)).join(" · ");
    const list = map.get(key) ?? [];
    list.push(b);
    map.set(key, list);
  }

  // Quand le cachet est le premier critère, on respecte l'ordre de
  // priorité de production plutôt que l'ordre alphabétique des labels.
  const cachetIsFirst = docSort[0] === "cachet";
  const groups = Array.from(map.entries()).sort(([labelA, itemsA], [labelB, itemsB]) => {
    if (cachetIsFirst) {
      const diff = cachetOrder(itemsA[0].cachet) - cachetOrder(itemsB[0].cachet);
      if (diff !== 0) return diff;
    }
    return labelA.localeCompare(labelB);
  });

  return groups.flatMap(([label, items]) => [...items].sort(nomSort).map((booking) => ({ booking, headerLabel: label })));
}

// Trombi HMC : ordre fixe heure -> cachet (priorité production) -> fonction
// -> nom, en-tête "Cachet · Heure" systématique — ce document a son propre
// tri imposé, indépendant du tri additif des autres documents.
export function buildFixedOrderTrombiItems(bookings: ConfirmedBooking[]): TrombiItem[] {
  const byHeure = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = b.heure_convocation ?? "";
    const list = byHeure.get(key) ?? [];
    list.push(b);
    byHeure.set(key, list);
  }

  const ordered: ConfirmedBooking[] = [];
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
      ordered.push(...[...sousGroup].sort((a, b) => (a.fonction ?? "").localeCompare(b.fonction ?? "") || nomSort(a, b)));
    }
  }

  return ordered.map((booking) => ({
    booking,
    headerLabel: `${booking.cachet ?? "Cachet non assigné"} · ${
      booking.heure_convocation ? formatHeureConvocation(booking.heure_convocation) : "Heure non renseignée"
    }`,
  }));
}
