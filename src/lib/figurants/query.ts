import type { createAdminClient } from "@/lib/supabase/admin";

export type FigurantFilters = {
  q?: string;
  ville?: string;
  myrole?: string;
  tag?: string;
};

export function buildFigurantsQuery(
  supabase: ReturnType<typeof createAdminClient>,
  params: FigurantFilters
) {
  let query = supabase.from("figurants").select("*").order("nom", { ascending: true });

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

  return query;
}
