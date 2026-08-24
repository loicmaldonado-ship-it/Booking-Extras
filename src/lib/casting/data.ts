import { createAdminClient } from "@/lib/supabase/admin";
import type { CastingRole, CastingEntry } from "./types";

export async function getCastingRoles(projetId: string): Promise<CastingRole[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_roles")
    .select("id, projet_id, nom, date_tournage, nb_videos, photo_labels, demande_bande_demo, created_at")
    .eq("projet_id", projetId)
    .order("date_tournage", { ascending: true, nullsFirst: false })
    .returns<CastingRole[]>();

  return data ?? [];
}

export async function getCastingEntries(projetId: string): Promise<CastingEntry[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_entries")
    .select(
      "id, projet_id, role_id, figurant_id, booking_id, candidature_id, request_token, video_storage_paths, requested_at, submitted_at, figurants(prenom, nom, email)"
    )
    .eq("projet_id", projetId)
    .order("requested_at", { ascending: false })
    .returns<CastingEntry[]>();

  return data ?? [];
}

export async function getCastingVideoUrls(storagePaths: string[]): Promise<string[]> {
  if (storagePaths.length === 0) return [];
  const supabase = createAdminClient();
  const urls = await Promise.all(
    storagePaths.map(async (path) => {
      const { data } = await supabase.storage.from("casting-videos").createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    })
  );
  return urls.filter((u): u is string => !!u);
}
