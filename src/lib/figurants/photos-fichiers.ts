import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Une photo peut être utilisée par plusieurs fiches (ex. photo du profil reprise
// dans un casting) : le fichier lui-même ne part du stockage que quand plus
// aucune fiche ne s'y réfère. À appeler APRÈS avoir supprimé la ligne de la photo.
export async function supprimerFichierPhotoSiOrphelin(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string
) {
  const { count } = await supabase
    .from("figurant_photos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", storagePath);
  if (!count) await supabase.storage.from("figurant-photos").remove([storagePath]);
}

// Avant de supprimer le fichier d'une photo : une autre fiche s'en sert-elle encore
// (photo reprise du profil sur un profil de casting, ou l'inverse) ?
export async function fichierPartageParUneAutreFiche(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string,
  photoId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("figurant_photos")
    .select("id")
    .eq("storage_path", storagePath)
    .neq("id", photoId)
    .limit(1)
    .maybeSingle();
  return !!data;
}
