"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";
import { createNotification } from "@/lib/notifications/create";

type EntryWithRole = {
  id: string;
  projet_id: string;
  figurant_id: string;
  statut: string;
  casting_roles: { nom: string; nb_videos: number; photo_labels: string[]; demande_bande_demo: boolean } | null;
  figurants: { prenom: string; nom: string } | null;
};

async function loadEntry(requestToken: string): Promise<EntryWithRole | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_entries")
    .select(
      "id, projet_id, figurant_id, statut, casting_roles(nom, nb_videos, photo_labels, demande_bande_demo), figurants(prenom, nom)"
    )
    .eq("request_token", requestToken)
    .maybeSingle<EntryWithRole>();
  return data;
}

// Génère une URL d'upload signée pour UN fichier précis (une vidéo n°X, ou
// la photo d'un libellé donné) — le navigateur du candidat envoie ensuite
// le fichier DIRECTEMENT à Supabase Storage avec cette URL, sans repasser
// par la fonction serveur Vercel. Sans ça, une vidéo volumineuse transitait
// navigateur -> fonction serveur -> Storage, et dépassait le temps
// d'exécution maximum de la fonction sur mobile/réseau lent — d'où l'échec
// "This page couldn't load" au moment d'envoyer.
export async function createCastingUploadSlot(
  requestToken: string,
  kind: "video" | "photo",
  slot: string
): Promise<{ bucket?: string; path?: string; token?: string; error?: string }> {
  const entry = await loadEntry(requestToken);
  if (!entry) return { error: "Ce lien n'est plus valide." };

  const role = entry.casting_roles;
  if (kind === "video") {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 0 || index >= (role?.nb_videos ?? 1)) {
      return { error: "Créneau vidéo invalide." };
    }
  } else if (!role?.photo_labels.includes(slot)) {
    return { error: "Créneau photo invalide." };
  }

  const bucket = kind === "video" ? "casting-videos" : "figurant-photos";
  const ext = kind === "video" ? "mp4" : "jpg";
  const path =
    kind === "video"
      ? `${entry.figurant_id}/${entry.id}-video-${slot}-${crypto.randomUUID()}.${ext}`
      : `${entry.figurant_id}/casting-${slot}-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Impossible de préparer l'envoi." };

  return { bucket, path: data.path, token: data.token };
}

// Appelée une fois tous les fichiers déjà envoyés directement à Storage
// (voir createCastingUploadSlot) : ne reçoit que des chemins, jamais de
// fichier — payload minuscule, aucun risque de timeout ici.
export async function finalizeCastingUpload(
  requestToken: string,
  payload: { videoPaths: string[]; photos: { label: string; path: string }[]; bandeDemo?: string }
): Promise<{ error?: string; success?: boolean }> {
  const entry = await loadEntry(requestToken);
  if (!entry) return { error: "Ce lien n'est plus valide." };

  const role = entry.casting_roles;
  if ((role?.nb_videos ?? 1) > 0 && payload.videoPaths.length === 0) {
    return { error: "Au moins une vidéo est obligatoire." };
  }

  const supabase = createAdminClient();

  for (const photo of payload.photos) {
    const { error } = await supabase.from("figurant_photos").insert({
      figurant_id: entry.figurant_id,
      type: "casting",
      storage_path: photo.path,
      projet_id: entry.projet_id,
      casting_entry_id: entry.id,
      label: photo.label,
    });
    if (error) return { error: error.message };
  }

  if (role?.demande_bande_demo && payload.bandeDemo?.trim()) {
    await upsertFigurantLienByLabel(supabase, entry.figurant_id, LIEN_BANDE_DEMO, payload.bandeDemo.trim());
  }

  // "À traiter" se met tout seul dès que tout est envoyé — jamais
  // "Complet" directement, ça reste un choix du staff une fois relu. Ne
  // fait jamais régresser un statut déjà avancé à la main (ex. si le staff
  // a déjà relancé ou validé avant un renvoi via ce même lien).
  const patch: { video_storage_paths: string[]; submitted_at: string; statut?: "envoyé" } = {
    video_storage_paths: payload.videoPaths,
    submitted_at: new Date().toISOString(),
  };
  if (entry.statut === "proposé") patch.statut = "envoyé";

  const { error } = await supabase.from("casting_entries").update(patch).eq("id", entry.id);
  if (error) return { error: error.message };

  if (entry.figurants) {
    await createNotification(
      "casting",
      `${entry.figurants.prenom} ${entry.figurants.nom} a envoyé sa vidéo/photos pour « ${role?.nom ?? "casting"} »`,
      { figurantId: entry.figurant_id, projetId: entry.projet_id, lien: "/casting" }
    );
  }

  revalidatePath("/casting");
  return { success: true };
}
