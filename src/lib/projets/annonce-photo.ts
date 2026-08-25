import type { createAdminClient } from "@/lib/supabase/admin";

export function getAnnoncePhotoUrl(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string | null | undefined
): string | null {
  if (!storagePath) return null;
  return supabase.storage.from("annonce-medias").getPublicUrl(storagePath).data.publicUrl;
}
