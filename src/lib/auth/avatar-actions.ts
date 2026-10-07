"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (!photo.type.startsWith("image/") || /heic|heif/i.test(photo.type)) {
    return { error: "Format non pris en charge : choisis une photo JPEG ou PNG." };
  }
  if (photo.size > 4 * 1024 * 1024) {
    return { error: "Photo trop lourde (4 Mo maximum) : choisis-en une autre." };
  }

  const supabase = createAdminClient();
  const ext = photo.name.split(".").pop() || "jpg";
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("profiles").update({ avatar_storage_path: path }).eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true as const };
}
