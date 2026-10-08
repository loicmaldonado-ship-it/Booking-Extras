import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reference } from "./types";

export const REFERENCES_BUCKET = "references-affiches";

// Références de l'accueil public, dans l'ordre choisi dans Admin. Le bucket
// des affiches est public : URL directe, pas de signature à renouveler.
export async function getReferences(options?: { visiblesSeulement?: boolean }): Promise<Reference[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("references_accueil")
    .select("id, titre, type, annee, realisation, affiche_storage_path, ordre, visible")
    .order("ordre")
    .order("created_at");
  if (options?.visiblesSeulement) query = query.eq("visible", true);
  const { data } = await query.returns<Omit<Reference, "afficheUrl">[]>();
  return (data ?? []).map((r) => ({
    ...r,
    afficheUrl: r.affiche_storage_path
      ? supabase.storage.from(REFERENCES_BUCKET).getPublicUrl(r.affiche_storage_path).data.publicUrl
      : null,
  }));
}
