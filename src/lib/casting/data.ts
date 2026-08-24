import { createAdminClient } from "@/lib/supabase/admin";
import type { CastingEntry } from "./types";

export async function getCastingEntries(projetId: string): Promise<CastingEntry[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_entries")
    .select(
      "id, projet_id, figurant_id, booking_id, candidature_id, silhouette, role_label, request_token, video_storage_path, requested_at, submitted_at, figurants(prenom, nom, email)"
    )
    .eq("projet_id", projetId)
    .order("requested_at", { ascending: false })
    .returns<CastingEntry[]>();

  return data ?? [];
}

export async function getCastingVideoUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("casting-videos").createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}
