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

// Le client privilégié contourne la RLS : le choix n'est ouvert que pour
// une personne ayant un booking dans ce projet.
async function verifierBookingProjet(projetId: string, figurantId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("bookings").select("id")
    .eq("projet_id", projetId).eq("figurant_id", figurantId).limit(1).maybeSingle();
  if (error || !data) return "Impossible de vérifier le booking de cette personne.";
  return null;
}

// Photos proposées pour les trombis / fiches d'une personne sur un projet,
// et la sélection actuelle (choix manuel ou par défaut).
export async function chargerChoixPhotos(
  projetId: string,
  figurantId: string
): Promise<{ error?: string; data?: ChoixPhotos }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const bookingError = await verifierBookingProjet(projetId, figurantId);
  if (bookingError) return { error: bookingError };
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
  const bookingError = await verifierBookingProjet(projetId, figurantId);
  if (bookingError) return { error: bookingError };
  const supabase = createAdminClient();

  if (photoIds === null || photoIds.length === 0) {
    const { error } = await supabase.from("projet_photos_choisies").delete().eq("projet_id", projetId).eq("figurant_id", figurantId);
    if (error) return { error: "Impossible de réinitialiser les photos." };
  } else {
    if (photoIds.length > PHOTOS_PAR_DOCUMENT || new Set(photoIds).size !== photoIds.length) return { error: "Sélection de photos invalide." };
    const ids = photoIds;
    const { data: siennes, error: photoError } = await supabase
      .from("figurant_photos")
      .select("id, projet_id")
      .eq("figurant_id", figurantId)
      .in("id", ids);
    const autorisees = new Set((siennes ?? []).filter((p) => p.projet_id === null || p.projet_id === projetId).map((p) => p.id));
    const valides = ids.filter((id) => autorisees.has(id));
    if (photoError || valides.length !== ids.length) return { error: "Impossible de vérifier toutes les photos sélectionnées." };
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
