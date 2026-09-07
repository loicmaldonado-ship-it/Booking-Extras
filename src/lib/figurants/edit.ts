"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Figurant, FigurantLien } from "./types";

// Données complètes pour le grand formulaire d'édition — chargées à la
// demande (à l'ouverture de la fenêtre d'édition), pas embarquées dans les
// listes qui affichent juste un sous-ensemble de champs (ex. carte casting).
export async function getFigurantForEdit(
  figurantId: string
): Promise<{ figurant: Figurant; liens: FigurantLien[] } | { error: string }> {
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("*")
    .eq("id", figurantId)
    .single<Figurant>();
  if (!figurant) return { error: "Profil introuvable." };

  const { data: liens } = await supabase
    .from("figurant_liens")
    .select("*")
    .eq("figurant_id", figurantId)
    .returns<FigurantLien[]>();

  return { figurant, liens: liens ?? [] };
}
