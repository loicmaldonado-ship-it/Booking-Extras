import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PhotoType } from "./types";
import { validateImageUpload } from "@/lib/media/validate-upload";

export { MAX_PHOTOS_PAR_FIGURANT } from "./types";

export async function countFigurantPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  figurantId: string
): Promise<number> {
  const { count } = await supabase
    .from("figurant_photos")
    .select("id", { count: "exact", head: true })
    .eq("figurant_id", figurantId);
  return count ?? 0;
}

export async function insertFigurantPhoto(
  supabase: ReturnType<typeof createAdminClient>,
  figurantId: string,
  type: PhotoType,
  file: File,
  extra?: { priseLe?: string | null; projetId?: string | null; castingEntryId?: string | null; label?: string | null }
): Promise<{ error?: string; id?: string }> {
  const validated = await validateImageUpload(file);
  if (validated.error) return { error: validated.error };
  const path = `${figurantId}/${type}-${crypto.randomUUID()}.${validated.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("figurant-photos")
    .upload(path, file, { contentType: validated.mimeType, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: photo, error: insertError } = await supabase.from("figurant_photos").insert({
    figurant_id: figurantId,
    type,
    storage_path: path,
    prise_le: extra?.priseLe ?? null,
    projet_id: extra?.projetId ?? null,
    casting_entry_id: extra?.castingEntryId ?? null,
    label: extra?.label ?? null,
  }).select("id").single();
  if (insertError || !photo) {
    const { error: cleanupError } = await supabase.storage.from("figurant-photos").remove([path]);
    if (cleanupError) return { error: "Photo non enregistrée ; le nettoyage du stockage a échoué." };
    return { error: insertError?.message ?? "Photo non enregistrée." };
  }

  return { id: photo.id };
}
