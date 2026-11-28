import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Convention } from "@/lib/projets/types";
import type { BaremeCachet, BaremeMajoration } from "./types";

// Barème par équipe (30/10/2026). Les lignes sans equipe_id sont la grille ACFDA de référence ; une équipe qui a
// modifié son barème (marqueur bareme_equipes) lit uniquement ses propres lignes, les autres lisent la référence.
// `equipe_cle` indique pour quelle équipe une ligne s'applique (y compris une ligne de référence).

type Admin = ReturnType<typeof createAdminClient>;
export type BaremeCachetEquipe = BaremeCachet & { equipe_cle: string };
export type BaremeMajorationEquipe = BaremeMajoration & { equipe_cle: string };

export async function clesEquipeProjets(admin: Admin, projetIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(projetIds.filter(Boolean)));
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await admin
    .from("projets")
    .select("id, owner:profiles!projets_owner_id_fkey(id, comedien_pool_id)")
    .in("id", ids)
    .returns<{ id: string; owner: { id: string; comedien_pool_id: string | null } | null }[]>();
  if (error) throw new Error("Impossible de déterminer l'équipe du projet.");
  for (const p of data ?? []) if (p.owner) out.set(p.id, p.owner.comedien_pool_id ?? p.owner.id);
  return out;
}

export async function cleEquipeProjet(admin: Admin, projetId: string): Promise<string | null> {
  return (await clesEquipeProjets(admin, [projetId])).get(projetId) ?? null;
}

async function equipesInitialisees(admin: Admin, cles: string[]): Promise<Set<string>> {
  if (cles.length === 0) return new Set();
  const { data, error } = await admin.from("bareme_equipes").select("equipe_id").in("equipe_id", cles);
  if (error) throw new Error("Impossible de lire le barème de l'équipe.");
  return new Set((data ?? []).map((r) => r.equipe_id as string));
}

export async function baremePourEquipes(
  admin: Admin,
  clesEquipe: string[],
  convention?: Convention | null
): Promise<{ cachets: BaremeCachetEquipe[]; majorations: BaremeMajorationEquipe[] }> {
  const cles = Array.from(new Set(clesEquipe.filter(Boolean)));
  if (cles.length === 0) return { cachets: [], majorations: [] };
  const init = await equipesInitialisees(admin, cles);
  const propres = cles.filter((c) => init.has(c));
  const surReference = cles.filter((c) => !init.has(c));

  const lire = async <T,>(table: "bareme_cachets" | "bareme_majorations", order: string) => {
    const rows: (T & { equipe_id: string | null })[] = [];
    if (propres.length) {
      let q = admin.from(table).select("*").in("equipe_id", propres).order(order);
      if (convention) q = q.eq("convention", convention);
      const { data, error } = await q;
      if (error) throw new Error("Impossible de lire le barème.");
      rows.push(...((data ?? []) as (T & { equipe_id: string | null })[]));
    }
    if (surReference.length) {
      let q = admin.from(table).select("*").is("equipe_id", null).order(order);
      if (convention) q = q.eq("convention", convention);
      const { data, error } = await q;
      if (error) throw new Error("Impossible de lire le barème de référence.");
      rows.push(...((data ?? []) as (T & { equipe_id: string | null })[]));
    }
    return rows;
  };

  const [cachetsBruts, majorationsBrutes] = await Promise.all([
    lire<BaremeCachet>("bareme_cachets", "cachet"),
    lire<BaremeMajoration>("bareme_majorations", "type"),
  ]);
  const etiqueter = <T extends { equipe_id: string | null }>(rows: T[]) =>
    rows.flatMap((r) => (r.equipe_id ? [{ ...r, equipe_cle: r.equipe_id }] : surReference.map((cle) => ({ ...r, equipe_cle: cle }))));
  return {
    cachets: etiqueter(cachetsBruts) as unknown as BaremeCachetEquipe[],
    majorations: etiqueter(majorationsBrutes) as unknown as BaremeMajorationEquipe[],
  };
}

// Garantit que l'équipe a sa propre copie, puis traduit l'identifiant affiché (référence ou copie) en ligne de
// l'équipe. Renvoie null si la ligne n'existe pas ou appartient à une autre équipe.
export async function ligneEquipe(
  admin: Admin,
  table: "bareme_cachets" | "bareme_majorations",
  cle: string,
  id: string
): Promise<string | null> {
  const { error: copyError } = await admin.rpc("copier_bareme_equipe", { p_equipe: cle });
  if (copyError) throw new Error("Impossible de préparer le barème de l'équipe.");
  const { data: row, error } = await admin.from(table).select("id, equipe_id").eq("id", id).maybeSingle<{ id: string; equipe_id: string | null }>();
  if (error) throw new Error("Impossible de lire le barème.");
  if (!row) return null;
  if (row.equipe_id === cle) return row.id;
  if (row.equipe_id !== null) return null;
  const { data: copie, error: copieError } = await admin
    .from(table).select("id").eq("equipe_id", cle).eq("source_id", row.id).maybeSingle<{ id: string }>();
  if (copieError) throw new Error("Impossible de lire le barème de l'équipe.");
  return copie?.id ?? null;
}

export async function preparerBaremeEquipe(admin: Admin, cle: string): Promise<void> {
  const { error } = await admin.rpc("copier_bareme_equipe", { p_equipe: cle });
  if (error) throw new Error("Impossible de préparer le barème de l'équipe.");
}
