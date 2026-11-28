"use server";

import { nomComplet } from "@/lib/noms";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";

export type SearchResult = {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
  kind: "figurant" | "projet" | "annonce";
};

import { hasSectionAccess } from "@/lib/auth/sections";
import { comedienPoolClause } from "@/lib/figurants/comedien-privacy";
import { buildProfileSearchFilter } from "@/lib/figurants/search-filter";

const RESULTS_PER_KIND = 5;

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = createAdminClient();
  const accessibleIds = await getAccessibleProjetIds(profile);
  const profileFilter = buildProfileSearchFilter(q);
  const poolClause = comedienPoolClause(profile);

  const [figurantsRes, projetsRes, annoncesRes] = await Promise.all([
    (() => {
      if (!hasSectionAccess(profile, "/figurants") || !profileFilter) return { data: [] };
      let query = supabase.from("figurants").select("id, prenom, nom, ville")
        .eq("confirme", true).eq("acces_compte", true).or(profileFilter).limit(RESULTS_PER_KIND);
      if (poolClause) query = query.or(poolClause);
      return query;
    })(),
    (() => {
      if (!hasSectionAccess(profile, "/projets")) return { data: [] };
      let query = supabase.from("projets").select("id, nom, lieu").ilike("nom", `%${q}%`).limit(RESULTS_PER_KIND);
      if (accessibleIds !== null) query = query.in("id", idsOrNone(accessibleIds));
      return query;
    })(),
    (() => {
      if (!hasSectionAccess(profile, "/annonces")) return { data: [] };
      let query = supabase
        .from("annonces")
        .select("id, titre, projets(nom)")
        .ilike("titre", `%${q}%`)
        .limit(RESULTS_PER_KIND);
      if (accessibleIds !== null) query = query.in("projet_id", idsOrNone(accessibleIds));
      return query;
    })(),
  ]);

  const results: SearchResult[] = [];

  for (const f of figurantsRes.data ?? []) {
    results.push({
      id: f.id,
      label: nomComplet(f),
      sublabel: f.ville,
      href: `/figurants/${f.id}`,
      kind: "figurant",
    });
  }

  for (const p of projetsRes.data ?? []) {
    results.push({
      id: p.id,
      label: p.nom,
      sublabel: p.lieu,
      href: `/projets/${p.id}`,
      kind: "projet",
    });
  }

  for (const a of (annoncesRes.data as { id: string; titre: string; projets: { nom: string } | null }[] | null) ?? []) {
    results.push({
      id: a.id,
      label: a.titre,
      sublabel: a.projets?.nom ?? null,
      href: `/annonces/${a.id}`,
      kind: "annonce",
    });
  }

  return results;
}
