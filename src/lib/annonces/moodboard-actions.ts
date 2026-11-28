"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/media/validate-upload";
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

  const { count, error: countError } = await supabase
    .from("annonce_photos")
    .select("id", { count: "exact", head: true })
    .eq("annonce_id", annonceId);
  if (countError || count === null) return { error: "Impossible de vérifier le nombre de photos." };
  if (count >= MAX_MOODBOARD_PHOTOS) {
    return { error: `Maximum ${MAX_MOODBOARD_PHOTOS} photos.` };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choisis une image." };
  }

  const validated = await validateImageUpload(photo);
  if (validated.error) return { error: validated.error };
  const ext = validated.extension;
  const path = `annonce/${annonceId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("annonce-medias")
    .upload(path, photo, { contentType: validated.mimeType, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("annonce_photos").insert({ annonce_id: annonceId, storage_path: path });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from("annonce-medias").remove([path]);
    if (cleanupError) return { error: "La photo n’a pas été ajoutée à l’annonce et son fichier n’a pas pu être supprimé du stockage." };
    return { error: "Impossible d’ajouter cette photo à l’annonce." };
  }

  revalidatePath(`/annonces/${annonceId}`);
  return { success: true as const };
}

export async function removeAnnoncePhoto(photoId: string) {
  const supabase = createAdminClient();
  const { data: photo, error: photoError } = await supabase
    .from("annonce_photos")
    .select("annonce_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (photoError || !photo) return { error: "Impossible de vérifier cette photo." };

  const accessError = await requireAnnonceAccess(supabase, photo.annonce_id);
  if (accessError) return { error: accessError };

  const { error: deleteError } = await supabase.from("annonce_photos").delete().eq("id", photoId);
  if (deleteError) return { error: "Impossible de supprimer cette photo." };
  const { error: storageError } = await supabase.storage.from("annonce-medias").remove([photo.storage_path]);
  revalidatePath(`/annonces/${photo.annonce_id}`);
  if (storageError) return { error: "La photo a été retirée de l’annonce, mais son fichier n’a pas pu être supprimé du stockage.", removed: true as const };
  return { success: true as const };
}
