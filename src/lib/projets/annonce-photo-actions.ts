"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

export async function updateProjetAnnoncePhoto(projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choisis une image." };
  }

  const supabase = createAdminClient();
  const ext = photo.name.split(".").pop() || "jpg";
  const path = `projet/${projetId}/photo-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("annonce-medias")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase
    .from("projets")
    .update({ annonce_photo_storage_path: path })
    .eq("id", projetId);
  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}`);
  revalidatePath("/annonces");
  return { success: true as const };
}

export async function removeProjetAnnoncePhoto(projetId: string) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projets")
    .update({ annonce_photo_storage_path: null })
    .eq("id", projetId);
  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}`);
  revalidatePath("/annonces");
  return { success: true as const };
}
