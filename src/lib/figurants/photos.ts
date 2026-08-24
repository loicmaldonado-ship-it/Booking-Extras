import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PhotoType } from "./types";

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
  extra?: { priseLe?: string | null; projetId?: string | null }
): Promise<{ error?: string }> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${figurantId}/${type}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("figurant-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("figurant_photos").insert({
    figurant_id: figurantId,
    type,
    storage_path: path,
    prise_le: extra?.priseLe ?? null,
    projet_id: extra?.projetId ?? null,
  });
  if (insertError) return { error: insertError.message };

  return {};
}
