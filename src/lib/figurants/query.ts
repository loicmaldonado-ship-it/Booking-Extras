import type { createAdminClient } from "@/lib/supabase/admin";
import { MENSURATION_RANGE_FIELDS, MENSURATION_TEXT_FIELDS, type MensurationFilters } from "@/lib/figurants/mensuration-filters";

export type FigurantFilters = {
  q?: string;
  ville?: string;
  myrole?: string;
  vehicule?: string;
  genre?: string;
  age_min?: string;
  age_max?: string;
  profil?: string;
} & MensurationFilters;

// Pas de colonne "âge" — calculé depuis date_naissance directement dans la
// requête (plutôt qu'en mémoire après coup) pour rester filtrable côté
// base même sur une liste de plusieurs milliers de profils.
function dateIlYA(annees: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - annees);
  return d.toISOString().slice(0, 10);
}

export function buildFigurantsQuery(
  supabase: ReturnType<typeof createAdminClient>,
  params: FigurantFilters,
  options?: { withCount?: boolean }
) {
  let query = supabase
    .from("figurants")
    .select("*", options?.withCount ? { count: "exact" } : undefined)
    .eq("confirme", true)
    .order("nom", { ascending: true });

  // Séparation figurant·es de figuration / comédien·nes (profils "rôle") —
  // deux pools distincts, jamais mélangés dans une même liste : les
  // comédien·nes ont souvent des fiches minimales (juste le nom) qui
  // noieraient les filtres pensés pour la figuration (mensurations,
  // véhicule...), et inversement.
  query = query.eq("est_comedien", params.profil === "comediens");

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
  if (params.genre) {
    query = query.eq("genre", params.genre);
  }
  if (params.age_min) {
    // Née il y a au moins age_min ans (ou avant) → au moins cet âge.
    query = query.lte("date_naissance", dateIlYA(Number(params.age_min)));
  }
  if (params.age_max) {
    // N'a pas encore atteint age_max + 1 ans → au plus cet âge.
    query = query.gt("date_naissance", dateIlYA(Number(params.age_max) + 1));
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
