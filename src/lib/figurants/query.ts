import type { createAdminClient } from "@/lib/supabase/admin";

export type FigurantFilters = {
  q?: string;
  ville?: string;
  myrole?: string;
  tag?: string;
  vehicule?: string;
};

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
  if (params.tag) {
    query = query.contains("tags", [params.tag]);
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
