"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { getSiteOrigin } from "@/lib/partage/data";

// Déclenché manuellement par le staff (depuis une candidature ou un
// booking) — jamais automatique, pour ne pas solliciter un candidat sans
// décision explicite de l'équipe. Idempotent : redemander à la même
// personne pour le même projet réutilise l'entrée existante (même lien).
export async function requestCastingVideo(
  projetId: string,
  figurantId: string,
  opts?: { bookingId?: string | null; candidatureId?: string | null }
): Promise<{ error?: string; success?: true }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("prenom, nom, email")
    .eq("id", figurantId)
    .maybeSingle();
  if (!figurant) return { error: "Profil introuvable." };
  if (!figurant.email) return { error: "Ce profil n'a pas d'email renseigné." };

  const { data: existing } = await supabase
    .from("casting_entries")
    .select("id, request_token")
    .eq("projet_id", projetId)
    .eq("figurant_id", figurantId)
    .maybeSingle();

  let requestToken = existing?.request_token;
  if (!existing) {
    const { data: created, error } = await supabase
      .from("casting_entries")
      .insert({
        projet_id: projetId,
        figurant_id: figurantId,
        booking_id: opts?.bookingId ?? null,
        candidature_id: opts?.candidatureId ?? null,
      })
      .select("request_token")
      .single();
    if (error) return { error: error.message };
    requestToken = created.request_token;
  }

  const origin = await getSiteOrigin();
  const link = `${origin}/casting/upload/${requestToken}`;

  const result = await sendEmail(
    figurant.email,
    "Booking Extras — vidéo & photos pour le casting",
    [
      `Bonjour ${figurant.prenom},`,
      "",
      "L'équipe de casting a besoin d'une courte vidéo (et de photos si tu le souhaites) pour te présenter au réalisateur·ice.",
      "",
      `Merci de tout envoyer via ce lien : ${link}`,
      "",
      "Si tu n'es pas à l'origine de cette demande, ignore ce message.",
    ].join("\n")
  );
  if (result.error) return { error: result.error };

  revalidatePath("/casting");
  return { success: true };
}

export async function toggleCastingSilhouette(entryId: string, silhouette: boolean) {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  await supabase.from("casting_entries").update({ silhouette }).eq("id", entryId);
  revalidatePath("/casting");
  return { success: true as const };
}

export async function updateCastingRoleLabel(entryId: string, roleLabel: string | null) {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  await supabase.from("casting_entries").update({ role_label: roleLabel }).eq("id", entryId);
  revalidatePath("/casting");
  return { success: true as const };
}

export async function deleteCastingEntry(entryId: string) {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, video_storage_path")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  if (entry.video_storage_path) {
    await supabase.storage.from("casting-videos").remove([entry.video_storage_path]);
  }
  await supabase.from("casting_entries").delete().eq("id", entryId);
  revalidatePath("/casting");
  return { success: true as const };
}
