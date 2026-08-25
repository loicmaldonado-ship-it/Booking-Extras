import type { createAdminClient } from "@/lib/supabase/admin";

export type MoodboardPhoto = { id: string; url: string };

export const MAX_MOODBOARD_PHOTOS = 8;

export async function getAnnoncePhotos(
  supabase: ReturnType<typeof createAdminClient>,
  annonceId: string
): Promise<MoodboardPhoto[]> {
  const { data } = await supabase
    .from("annonce_photos")
    .select("id, storage_path")
    .eq("annonce_id", annonceId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    url: supabase.storage.from("annonce-medias").getPublicUrl(p.storage_path).data.publicUrl,
  }));
}
