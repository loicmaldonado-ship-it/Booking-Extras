import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EssayageLieu = { nom: string | null; adresse: string | null };

export async function getEssayageLieuProjet(projetId: string): Promise<EssayageLieu> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("essayage_lieux")
    .select("nom, adresse")
    .eq("projet_id", projetId)
    .maybeSingle();
  return { nom: data?.nom ?? null, adresse: data?.adresse ?? null };
}
