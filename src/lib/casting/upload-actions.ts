"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";

export async function submitCastingUpload(
  requestToken: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createAdminClient();

  const { data: entry } = await supabase
    .from("casting_entries")
    .select("id, projet_id, figurant_id, role_id, casting_roles(nb_videos, photo_labels, demande_bande_demo)")
    .eq("request_token", requestToken)
    .maybeSingle<{
      id: string;
      projet_id: string;
      figurant_id: string;
      role_id: string;
      casting_roles: { nb_videos: number; photo_labels: string[]; demande_bande_demo: boolean } | null;
    }>();
  if (!entry) return { error: "Ce lien n'est plus valide." };

  const role = entry.casting_roles;
  const nbVideos = role?.nb_videos ?? 1;
  const photoLabels = role?.photo_labels ?? [];

  const videos = formData.getAll("video").filter((v): v is File => v instanceof File && v.size > 0);
  if (nbVideos > 0 && videos.length === 0) {
    return { error: "Au moins une vidéo est obligatoire." };
  }

  const videoPaths: string[] = [];
  for (const video of videos) {
    const ext = video.name.split(".").pop() || "mp4";
    const path = `${entry.figurant_id}/${entry.id}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("casting-videos")
      .upload(path, video, { contentType: video.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
    videoPaths.push(path);
  }

  for (const label of photoLabels) {
    const photo = formData.get(`photo__${label}`);
    if (photo instanceof File && photo.size > 0) {
      const result = await insertFigurantPhoto(supabase, entry.figurant_id, "casting", photo, {
        projetId: entry.projet_id,
        castingEntryId: entry.id,
        label,
      });
      if (result.error) return { error: result.error };
    }
  }

  if (role?.demande_bande_demo) {
    const bandeDemo = String(formData.get("bande_demo") ?? "").trim();
    if (bandeDemo) {
      await upsertFigurantLienByLabel(supabase, entry.figurant_id, LIEN_BANDE_DEMO, bandeDemo);
    }
  }

  const { error } = await supabase
    .from("casting_entries")
    .update({ video_storage_paths: videoPaths, submitted_at: new Date().toISOString() })
    .eq("id", entry.id);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}
