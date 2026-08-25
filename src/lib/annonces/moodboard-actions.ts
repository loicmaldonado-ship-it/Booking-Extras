"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { MAX_MOODBOARD_PHOTOS } from "./moodboard";

async function requireAnnonceAccess(supabase: ReturnType<typeof createAdminClient>, annonceId: string) {
  const { data: annonce } = await supabase.from("annonces").select("projet_id").eq("id", annonceId).maybeSingle();
  if (!annonce) return "Annonce introuvable.";
  return checkProjetAccess(annonce.projet_id);
}

export async function addAnnoncePhoto(annonceId: string, formData: FormData) {
  const supabase = createAdminClient();
  const accessError = await requireAnnonceAccess(supabase, annonceId);
  if (accessError) return { error: accessError };

  const { count } = await supabase
    .from("annonce_photos")
    .select("id", { count: "exact", head: true })
    .eq("annonce_id", annonceId);
  if ((count ?? 0) >= MAX_MOODBOARD_PHOTOS) {
    return { error: `Maximum ${MAX_MOODBOARD_PHOTOS} photos.` };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choisis une image." };
  }

  const ext = photo.name.split(".").pop() || "jpg";
  const path = `annonce/${annonceId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("annonce-medias")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("annonce_photos").insert({ annonce_id: annonceId, storage_path: path });
  if (error) return { error: error.message };

  revalidatePath(`/annonces/${annonceId}`);
  return { success: true as const };
}

export async function removeAnnoncePhoto(photoId: string) {
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("annonce_photos")
    .select("annonce_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return;

  const accessError = await requireAnnonceAccess(supabase, photo.annonce_id);
  if (accessError) return { error: accessError };

  await supabase.storage.from("annonce-medias").remove([photo.storage_path]);
  await supabase.from("annonce_photos").delete().eq("id", photoId);
  revalidatePath(`/annonces/${photo.annonce_id}`);
}
