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

// Découpe en pages en respectant les groupes (même en-tête) autant que
// possible, plutôt qu'un simple découpage par nombre fixe — un en-tête
// force un retour à la ligne dans la grille en flex-wrap, donc plusieurs
// petits groupes sur une même page consomment beaucoup plus de hauteur que
// le même nombre de profils dans un seul groupe. Sans ça, une page pouvait
// déborder de son cadre fixe et perdre silencieusement des profils au
// PDF/impression (capture html2canvas bornée à la hauteur de la page).
//
// Le budget est exprimé en LIGNES (pas en nombre brut de profils) : chaque
// groupe consomme ceil(taille / colonnes) lignes, et un nouveau groupe ne
// commence jamais à cheval sur une ligne déjà entamée par le précédent.
// columns=9 et maxRowsPerPage=3 sont calibrés sur la taille réelle d'une
// page trombi en paysage (1123×794, cf. mesures DOM — 9 colonnes de 96px
// tiennent réellement par ligne) — à resserrer si on ajoute des champs qui
// allongent les légendes sous chaque photo.
export function paginateGroupedItems<T>(
  items: T[],
  groupKeyOf: (item: T) => string | null,
  { columns = 9, maxRowsPerPage = 3 }: { columns?: number; maxRowsPerPage?: number } = {}
): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const key = groupKeyOf(item);
    const last = groups[groups.length - 1];
    if (last && groupKeyOf(last[0]) === key) last.push(item);
    else groups.push([item]);
  }

  const maxItemsPerPage = maxRowsPerPage * columns;
  const pages: T[][] = [];
  let current: T[] = [];
  let currentRows = 0;

  for (const group of groups) {
    const groupRows = Math.ceil(group.length / columns);
    if (groupRows > maxRowsPerPage) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        currentRows = 0;
      }
      for (let i = 0; i < group.length; i += maxItemsPerPage) {
        pages.push(group.slice(i, i + maxItemsPerPage));
      }
      continue;
    }
    if (current.length > 0 && currentRows + groupRows > maxRowsPerPage) {
      pages.push(current);
      current = [];
      currentRows = 0;
    }
    current.push(...group);
    currentRows += groupRows;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

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
