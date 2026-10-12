"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import type { Figurant, FigurantLien } from "./types";

// Données complètes pour le grand formulaire d'édition — chargées à la
// demande (à l'ouverture de la fenêtre d'édition), pas embarquées dans les
// listes qui affichent juste un sous-ensemble de champs (ex. carte casting).
export async function getFigurantForEdit(
  figurantId: string
): Promise<{ figurant: Figurant; liens: FigurantLien[] } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non autorisé." };
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("*")
    .eq("id", figurantId)
    .single<Figurant & { comedien_pool_id: string | null }>();
  if (!figurant) return { error: "Profil introuvable." };
  // The service_role bypasses RLS, so enforce the actor's casting pool here.
  if (figurant.est_comedien && !profile.isOwner &&
      figurant.comedien_pool_id !== comedienPoolIdFor(profile)) {
    return { error: "Profil introuvable." };
  }

  const { data: liens } = await supabase
    .from("figurant_liens")
    .select("*")
    .eq("figurant_id", figurantId)
    .returns<FigurantLien[]>();

  return { figurant, liens: liens ?? [] };
}
