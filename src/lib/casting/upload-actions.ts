"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertFigurantPhoto } from "@/lib/figurants/photos";

export async function submitCastingUpload(
  requestToken: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createAdminClient();

  const { data: entry } = await supabase
    .from("casting_entries")
    .select("id, projet_id, figurant_id")
    .eq("request_token", requestToken)
    .maybeSingle();
  if (!entry) return { error: "Ce lien n'est plus valide." };

  const video = formData.get("video");
  if (!(video instanceof File) || video.size === 0) {
    return { error: "La vidéo est obligatoire." };
  }

  const ext = video.name.split(".").pop() || "mp4";
  const path = `${entry.figurant_id}/${entry.id}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("casting-videos")
    .upload(path, video, { contentType: video.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  for (const photo of formData.getAll("photo")) {
    if (photo instanceof File && photo.size > 0) {
      await insertFigurantPhoto(supabase, entry.figurant_id, "casting", photo, { projetId: entry.projet_id });
    }
  }

  const { error } = await supabase
    .from("casting_entries")
    .update({ video_storage_path: path, submitted_at: new Date().toISOString() })
    .eq("id", entry.id);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}
