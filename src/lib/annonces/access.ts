import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

// Petites tables rattachées à une annonce (dates, questions...) — pas de
// projet_id direct, il faut d'abord retrouver celui de l'annonce.
export async function checkAnnonceAccess(annonceId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: annonce } = await supabase.from("annonces").select("projet_id").eq("id", annonceId).maybeSingle();
  if (!annonce) return null;
  return checkProjetAccess(annonce.projet_id);
}
