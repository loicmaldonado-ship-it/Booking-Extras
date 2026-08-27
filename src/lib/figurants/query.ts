import type { createAdminClient } from "@/lib/supabase/admin";
import { MENSURATION_RANGE_FIELDS, MENSURATION_TEXT_FIELDS, type MensurationFilters } from "@/lib/figurants/mensuration-filters";

export type FigurantFilters = {
  q?: string;
  ville?: string;
  myrole?: string;
  vehicule?: string;
} & MensurationFilters;

export function buildFigurantsQuery(
  supabase: ReturnType<typeof createAdminClient>,
  params: FigurantFilters
) {
  let query = supabase
    .from("figurants")
    .select("*")
    .eq("confirme", true)
    .order("nom", { ascending: true });

  if (params.q) {
    query = query.or(
      `nom.ilike.%${params.q}%,prenom.ilike.%${params.q}%,email.ilike.%${params.q}%`
    );
  }
  if (params.ville) {
    query = query.ilike("ville", `%${params.ville}%`);
  }
  if (params.myrole === "oui") {
    query = query.eq("compte_myrole", true);
  } else if (params.myrole === "non") {
    query = query.eq("compte_myrole", false);
  }
  if (params.code_postal) {
    query = query.ilike("code_postal", `${params.code_postal}%`);
  }
  for (const f of MENSURATION_RANGE_FIELDS) {
    const min = params[`${f.key}_min`];
    const max = params[`${f.key}_max`];
    if (min) query = query.gte(f.column, Number(min));
    if (max) query = query.lte(f.column, Number(max));
  }
  for (const f of MENSURATION_TEXT_FIELDS) {
    const value = params[f.key];
    if (value) query = query.ilike(f.key, `%${value}%`);
  }
  if (params.vehicule === "oui") {
    query = query.eq("a_vehicule", true);
  } else if (params.vehicule === "non") {
    query = query.eq("a_vehicule", false);
  } else if (params.vehicule === "velo") {
    query = query.eq("vehicule_velo", true);
  } else if (params.vehicule === "moto") {
    query = query.eq("vehicule_moto", true);
  } else if (params.vehicule === "scooter") {
    query = query.eq("vehicule_scooter", true);
  }

  return query;
}
