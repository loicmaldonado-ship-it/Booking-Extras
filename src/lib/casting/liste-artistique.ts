import { getCastingRoles, getCastingEntries } from "./data";
import type { CastingRole, CastingEntry } from "./types";

export type ListeArtistiqueItem = {
  numero: number;
  role: CastingRole;
  entry: CastingEntry;
};

// Seuls les rôles avec un comédien validé — même filtre que "Fiches rôles
// validés", pour que les deux documents montrent toujours la même liste.
// Numérotés 1..N sur les rôles effectivement affichés (pas sur l'ensemble
// du casting), pour rester contigu même quand des rôles ne sont pas
// encore validés.
export async function getListeArtistiqueItems(projetId: string): Promise<ListeArtistiqueItem[]> {
  const [roles, entries] = await Promise.all([getCastingRoles(projetId), getCastingEntries(projetId)]);

  const entriesByRole = new Map<string, CastingEntry[]>();
  for (const e of entries) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }

  const items: ListeArtistiqueItem[] = [];
  for (const role of roles) {
    const entry = (entriesByRole.get(role.id) ?? []).find((e) => e.statut === "valide");
    if (entry) items.push({ numero: 0, role, entry });
  }
  items.forEach((item, i) => {
    item.numero = i + 1;
  });
  return items;
}
