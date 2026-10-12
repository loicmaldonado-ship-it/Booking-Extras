"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { getPhotosProjet, PHOTOS_PAR_DOCUMENT } from "@/lib/documents/photos-projet";

export type PhotoChoix = { id: string; url: string; type: string };
export type ChoixPhotos = {
  essayage: PhotoChoix[];
  candidature: PhotoChoix[];
  compte: PhotoChoix[];
  selection: string[];
  manuel: boolean;
};

const versChoix = (p: { id: string; url: string | null; type: string }): PhotoChoix => ({ id: p.id, url: p.url ?? "", type: p.type });

// Photos proposées pour les trombis / fiches d'une personne sur un projet,
// et la sélection actuelle (choix manuel ou par défaut).
export async function chargerChoixPhotos(
  projetId: string,
  figurantId: string
): Promise<{ error?: string; data?: ChoixPhotos }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const detail = (await getPhotosProjet(projetId, [figurantId])).get(figurantId);
  if (!detail) return { error: "Personne introuvable." };
  return {
    data: {
      essayage: detail.essayage.map(versChoix),
      candidature: detail.candidature.map(versChoix),
      compte: detail.compte.map(versChoix),
      selection: detail.selection.map((p) => p.id),
      manuel: detail.manuel,
    },
  };
}

// photoIds = null : retour au choix par défaut.
export async function enregistrerChoixPhotos(
  projetId: string,
  figurantId: string,
  photoIds: string[] | null
): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();

  if (photoIds === null || photoIds.length === 0) {
    await supabase.from("projet_photos_choisies").delete().eq("projet_id", projetId).eq("figurant_id", figurantId);
  } else {
    const ids = Array.from(new Set(photoIds)).slice(0, PHOTOS_PAR_DOCUMENT);
    const { data: siennes } = await supabase
      .from("figurant_photos")
      .select("id")
      .eq("figurant_id", figurantId)
      .in("id", ids);
    const autorisees = new Set((siennes ?? []).map((p) => p.id));
    const valides = ids.filter((id) => autorisees.has(id));
    if (valides.length === 0) return { error: "Aucune photo valide sélectionnée." };
    const { error } = await supabase
      .from("projet_photos_choisies")
      .upsert(
        { projet_id: projetId, figurant_id: figurantId, photo_ids: valides, updated_at: new Date().toISOString() },
        { onConflict: "projet_id,figurant_id" }
      );
    if (error) return { error: error.message };
  }

  revalidatePath("/bookings/documents");
  return {};
}
