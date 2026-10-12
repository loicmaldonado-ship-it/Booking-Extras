import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sert à préremplir les indemnités d'un nouveau projet avec celles du
// dernier projet créé, pour éviter de tout ressaisir à chaque fois.
export async function getLastProjetIndemnites(chefId: string): Promise<{ label: string; montant: number }[]> {
  const supabase = createAdminClient();
  const { data: lastProjet } = await supabase
    .from("projets")
    .select("id")
    // Ne jamais reprendre les indemnités d’un projet appartenant à une autre équipe.
    .eq("owner_id", chefId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastProjet) return [];

  const { data } = await supabase
    .from("projet_indemnites")
    .select("label, montant")
    .eq("projet_id", lastProjet.id)
    .order("created_at");
  return data ?? [];
}
