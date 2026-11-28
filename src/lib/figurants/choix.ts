import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSectionAccess } from "@/lib/auth/sections";
import type { CurrentProfile } from "@/lib/auth/session";

// Sans la section « Base Profils », la RLS ne montre plus les fiches de la base partagée (audit du 31/10/2026) :
// les listes de choix (Bookings, Casting, Essayages, Mineurs) reçoivent alors les noms seuls via figurants_choix.
export function sansBaseProfils(profile: CurrentProfile | null | undefined): boolean {
  return !!profile && !profile.isOwner && !hasSectionAccess(profile, "/figurants");
}

export type ChoixFigurant = { id: string; prenom: string; nom: string; date_naissance: string | null };

export async function figurantsChoix(ids?: string[]): Promise<ChoixFigurant[]> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("figurants_choix", ids ? { p_ids: ids } : {});
  if (error) return [];
  return (data ?? []) as ChoixFigurant[];
}

// Complète une liste lue sous RLS avec les noms de la base partagée, sans doublon, triée par nom puis prénom.
export async function completerChoix<T extends { id: string; prenom: string; nom: string }>(
  liste: T[] | null | undefined,
  profile: CurrentProfile | null | undefined,
  versLigne: (c: ChoixFigurant) => T
): Promise<T[]> {
  const base = liste ?? [];
  if (!sansBaseProfils(profile)) return base;
  const vus = new Set(base.map((f) => f.id));
  const ajout = (await figurantsChoix()).filter((c) => !vus.has(c.id)).map(versLigne);
  return [...base, ...ajout].sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
}
