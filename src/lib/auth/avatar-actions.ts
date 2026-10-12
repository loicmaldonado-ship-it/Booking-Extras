"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/media/validate-upload";
import { getCurrentProfile } from "@/lib/auth/session";

export async function updateMyAvatar(_prevState: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté." };

  const photo = formData.get("avatar");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choisis une image." };
  }
  // Le navigateur réduit déjà la photo (prepareAvatar) ; garde-fou si un
  // fichier arrive quand même tel quel.
  const validated = await validateImageUpload(photo, 4 * 1024 * 1024);
  if (validated.error) return { error: validated.error };

  const supabase = createAdminClient();
  const ext = validated.extension;
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(path, photo, { contentType: validated.mimeType, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("profiles").update({ avatar_storage_path: path }).eq("id", profile.id);
  if (error) {
    await supabase.storage.from("profile-avatars").remove([path]);
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true as const };
}
