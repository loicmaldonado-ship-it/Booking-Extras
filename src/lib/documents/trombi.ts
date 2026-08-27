import { formatHeureConvocation } from "./fields";
import type { ConfirmedBooking, CovoiturageInfo } from "./data";
import { ageBracket, type Dimension, type DocSort } from "./sort";
import { montantCovoiturage } from "@/lib/bookings/covoiturage-messages";

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

// Nom de famille seul (pas prénom+nom comme nomSort) — utilisé par le
// trombi covoiturage, où l'objectif est justement de trier par nom de
// famille pour repérer les gens du même coin d'un coup d'œil.
function nomFamilleSort(a: ConfirmedBooking, b: ConfirmedBooking) {
  return a.figurant.nom.localeCompare(b.figurant.nom) || nomOf(a).localeCompare(nomOf(b));
}

function dimensionLabel(b: ConfirmedBooking, dim: Dimension): string {
  if (dim === "fonction") return b.fonction ?? "Sans fonction";
  if (dim === "cachet") return b.cachet ?? "Sans cachet";
  if (dim === "sexe") return b.figurant.genre ?? "Non renseigné";
  if (dim === "heure") return b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "Heure non renseignée";
  return ageBracket(b.figurant.date_naissance);
}

export type TrombiItem = { booking: ConfirmedBooking; headerLabel: string | null; badge?: string };

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

// Ordre d'affichage du genre — les groupes HMC (habillage/maquillage/
// coiffure ont souvent des postes de prépa séparés par genre) suivent cet
// ordre plutôt que l'alphabétique.
const GENRE_ORDER = ["Femme", "Homme", "Non-binaire", "Autre"];

function genreOrder(genre: string | null) {
  const idx = genre ? GENRE_ORDER.indexOf(genre) : -1;
  return idx === -1 ? GENRE_ORDER.length : idx;
}

// Trombi HMC : ordre fixe heure -> genre -> cachet (priorité production) ->
// fonction -> nom, en-tête "Heure · Genre · Cachet" systématique — ce
// document a son propre tri imposé, indépendant du tri additif des autres
// documents. Le genre est séparé pour que l'équipe HMC organise ses postes
// de prépa (femme/homme/non-binaire) sans avoir à trier elle-même.
export function buildFixedOrderTrombiItems(bookings: ConfirmedBooking[]): TrombiItem[] {
  const byHeure = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = b.heure_convocation ?? "";
    const list = byHeure.get(key) ?? [];
    list.push(b);
    byHeure.set(key, list);
  }

  const items: TrombiItem[] = [];
  for (const [heure, heureGroup] of Array.from(byHeure.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const heureLabel = heure ? formatHeureConvocation(heure) : "Heure non renseignée";

    const byGenre = new Map<string, ConfirmedBooking[]>();
    for (const b of heureGroup) {
      const key = b.figurant.genre ?? "Non renseigné";
      const list = byGenre.get(key) ?? [];
      list.push(b);
      byGenre.set(key, list);
    }
    const genreGroups = Array.from(byGenre.entries()).sort(
      ([labelA, itemsA], [labelB, itemsB]) => genreOrder(itemsA[0]?.figurant.genre ?? null) - genreOrder(itemsB[0]?.figurant.genre ?? null) || labelA.localeCompare(labelB)
    );

    for (const [genreLabel, genreGroup] of genreGroups) {
      const byCachet = new Map<string, ConfirmedBooking[]>();
      for (const b of genreGroup) {
        const key = b.cachet ?? "";
        const list = byCachet.get(key) ?? [];
        list.push(b);
        byCachet.set(key, list);
      }
      const cachetGroups = Array.from(byCachet.entries()).sort(
        (a, b) => cachetOrder(a[1][0]?.cachet ?? null) - cachetOrder(b[1][0]?.cachet ?? null)
      );
      for (const [, sousGroup] of cachetGroups) {
        const sorted = [...sousGroup].sort(
          (a, b) => (a.fonction ?? "").localeCompare(b.fonction ?? "") || nomSort(a, b)
        );
        const headerLabel = `${heureLabel} · ${genreLabel} · ${sorted[0]?.cachet ?? "Cachet non assigné"}`;
        for (const booking of sorted) {
          items.push({ booking, headerLabel });
        }
      }
    }
  }

  return items;
}

// Trombi covoiturage : un groupe par conducteur·rice (soi-même + ses
// passagers, badge 🚗), puis le reste réparti en groupes "Sans covoiturage
// · {code postal}" — classés par code postal croissant pour repérer d'un
// coup d'œil qui habite dans le même coin (organiser un covoiturage
// manuellement), chaque groupe trié par nom de famille. Un·e passager·ère
// dont le·la conducteur·rice n'est plus dans le booking du jour retombe
// dans "Sans covoiturage" plutôt que d'être perdu·e silencieusement.
export function buildCovoiturageTrombiItems(
  bookings: ConfirmedBooking[],
  covoiturageByFigurant: Map<string, CovoiturageInfo>,
  tarifBase: number,
  tarifPassager: number
): TrombiItem[] {
  const infoOf = (b: ConfirmedBooking) => covoiturageByFigurant.get(b.figurant.id) ?? null;
  const conducteurs = bookings.filter((b) => infoOf(b)?.covoiturage_role === "conducteur");

  const items: TrombiItem[] = [];
  const handledIds = new Set<string>();

  for (const conducteur of [...conducteurs].sort(nomFamilleSort)) {
    const info = infoOf(conducteur)!;
    const passagers = bookings.filter((b) => infoOf(b)?.covoiturage_conducteur_id === conducteur.figurant.id);
    const indemnite = montantCovoiturage(passagers.length, tarifBase, tarifPassager);
    const headerLabel = `🚗 ${nomOf(conducteur)} · Départ : ${info.covoiturage_lieu_depart ?? "à confirmer"}${
      info.covoiturage_places_disponibles !== null ? ` · ${info.covoiturage_places_disponibles} place(s)` : ""
    } · Indemnité ${indemnite}€`;

    items.push({ booking: conducteur, headerLabel, badge: "🚗" });
    handledIds.add(conducteur.figurant.id);
    for (const passager of [...passagers].sort(nomFamilleSort)) {
      items.push({ booking: passager, headerLabel });
      handledIds.add(passager.figurant.id);
    }
  }

  const sansCovoiturage = bookings.filter((b) => !handledIds.has(b.figurant.id));
  const byPostal = new Map<string, ConfirmedBooking[]>();
  for (const b of sansCovoiturage) {
    const key = b.figurant.code_postal ?? "";
    const list = byPostal.get(key) ?? [];
    list.push(b);
    byPostal.set(key, list);
  }
  const postalGroups = Array.from(byPostal.entries()).sort(([a], [b]) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
  for (const [postal, group] of postalGroups) {
    const headerLabel = `Sans covoiturage · ${postal || "Code postal non renseigné"}`;
    for (const booking of [...group].sort(nomFamilleSort)) {
      items.push({ booking, headerLabel });
    }
  }

  return items;
}

// Regroupe une liste d'items déjà ordonnée (comme buildCovoiturageTrombiItems
// la produit) par headerLabel consécutif — pour un rendu texte simple
// (liste de noms par groupe) plutôt que la grille photo.
export function groupItemsByHeader(items: TrombiItem[]): { headerLabel: string; items: TrombiItem[] }[] {
  const groups: { headerLabel: string; items: TrombiItem[] }[] = [];
  for (const item of items) {
    const label = item.headerLabel ?? "";
    const last = groups[groups.length - 1];
    if (last && last.headerLabel === label) last.items.push(item);
    else groups.push({ headerLabel: label, items: [item] });
  }
  return groups;
}
