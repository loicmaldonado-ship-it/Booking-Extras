"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { getSiteOrigin } from "@/lib/partage/data";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { substituteTokens } from "@/lib/bookings/convocation";
import type { CastingRole } from "./types";

function parsePhotoLabels(formData: FormData): string[] {
  return formData
    .getAll("photo_label")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export async function createCastingRole(
  projetId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom du rôle est obligatoire." };

  const dateTournage = String(formData.get("date_tournage") ?? "").trim() || null;
  const nbVideos = Math.max(0, Number(formData.get("nb_videos") ?? 1) || 0);
  const photoLabels = parsePhotoLabels(formData);
  const demandeBandeDemo = formData.get("demande_bande_demo") === "on";
  const messageCorps = String(formData.get("message_corps") ?? "").trim() || null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("casting_roles").insert({
    projet_id: projetId,
    nom,
    date_tournage: dateTournage,
    nb_videos: nbVideos,
    photo_labels: photoLabels,
    demande_bande_demo: demandeBandeDemo,
    message_corps: messageCorps,
  });
  if (error) return { error: error.code === "23505" ? "Un rôle avec ce nom existe déjà sur ce projet." : error.message };

  revalidatePath("/casting");
  return { success: true };
}

export async function updateCastingRoleCalibration(
  roleId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: role } = await supabase.from("casting_roles").select("projet_id").eq("id", roleId).maybeSingle();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom du rôle est obligatoire." };

  const dateTournage = String(formData.get("date_tournage") ?? "").trim() || null;
  const nbVideos = Math.max(0, Number(formData.get("nb_videos") ?? 1) || 0);
  const photoLabels = parsePhotoLabels(formData);
  const demandeBandeDemo = formData.get("demande_bande_demo") === "on";
  const messageCorps = String(formData.get("message_corps") ?? "").trim() || null;

  const { error } = await supabase
    .from("casting_roles")
    .update({
      nom,
      date_tournage: dateTournage,
      nb_videos: nbVideos,
      photo_labels: photoLabels,
      demande_bande_demo: demandeBandeDemo,
      message_corps: messageCorps,
    })
    .eq("id", roleId);
  if (error) return { error: error.code === "23505" ? "Un rôle avec ce nom existe déjà sur ce projet." : error.message };

  revalidatePath("/casting");
  return { success: true };
}

export async function deleteCastingRole(roleId: string) {
  const supabase = createAdminClient();
  const { data: role } = await supabase.from("casting_roles").select("projet_id").eq("id", roleId).maybeSingle();
  if (!role) return;
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) throw new Error(accessError);

  const { data: entries } = await supabase.from("casting_entries").select("video_storage_paths").eq("role_id", roleId);
  const allPaths = (entries ?? []).flatMap((e) => e.video_storage_paths ?? []);
  if (allPaths.length > 0) await supabase.storage.from("casting-videos").remove(allPaths);

  await supabase.from("casting_roles").delete().eq("id", roleId);
  revalidatePath("/casting");
}

function inviteEmailBody(params: {
  prenom: string;
  roleNom: string;
  projetNom: string;
  dateTournage: string | null;
  nbVideos: number;
  photoLabels: string[];
  demandeBandeDemo: boolean;
  link: string;
  customBody: string | null;
}) {
  const { prenom, roleNom, projetNom, dateTournage, nbVideos, photoLabels, demandeBandeDemo, link, customBody } =
    params;

  if (customBody) {
    return substituteTokens(customBody, {
      prenom,
      role: roleNom,
      projet: projetNom,
      date: dateTournage ?? "",
      lien: link,
    });
  }

  const besoin: string[] = [];
  if (nbVideos > 0) besoin.push(`${nbVideos} vidéo${nbVideos > 1 ? "s" : ""} de présentation`);
  if (photoLabels.length > 0) besoin.push(`${photoLabels.length} photo${photoLabels.length > 1 ? "s" : ""} (${photoLabels.join(", ")})`);
  if (demandeBandeDemo) besoin.push("un lien vers votre bande démo");

  return [
    `Bonjour ${prenom},`,
    "",
    `L'équipe de casting du projet « ${projetNom} » vous propose pour le rôle « ${roleNom} »` +
      (dateTournage ? ` (tournage le ${dateTournage})` : "") +
      ".",
    "",
    besoin.length > 0
      ? `Merci de nous envoyer, via ce lien : ${besoin.join(", ")}.`
      : `Merci de tout envoyer via ce lien : ${link}`,
    ...(besoin.length > 0 ? ["", link] : []),
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  ].join("\n");
}

async function createEntryAndInvite(
  role: Pick<
    CastingRole,
    "id" | "nom" | "projet_id" | "date_tournage" | "nb_videos" | "photo_labels" | "demande_bande_demo" | "message_corps"
  >,
  figurantId: string,
  opts?: { bookingId?: string | null; candidatureId?: string | null }
): Promise<{ error?: string; created?: boolean }> {
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
    .select("id")
    .eq("role_id", role.id)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (existing) return { created: false };

  const { data: projet } = await supabase.from("projets").select("nom").eq("id", role.projet_id).maybeSingle();

  const { data: created, error } = await supabase
    .from("casting_entries")
    .insert({
      projet_id: role.projet_id,
      role_id: role.id,
      figurant_id: figurantId,
      booking_id: opts?.bookingId ?? null,
      candidature_id: opts?.candidatureId ?? null,
    })
    .select("request_token")
    .single();
  if (error) return { error: error.message };

  const origin = await getSiteOrigin();
  const link = `${origin}/casting/upload/${created.request_token}`;

  const result = await sendEmail(
    figurant.email,
    `Booking Extras — casting « ${role.nom} »`,
    inviteEmailBody({
      prenom: figurant.prenom,
      roleNom: role.nom,
      projetNom: projet?.nom ?? "",
      dateTournage: role.date_tournage,
      nbVideos: role.nb_videos,
      photoLabels: role.photo_labels,
      demandeBandeDemo: role.demande_bande_demo,
      link,
      customBody: role.message_corps,
    })
  );
  if (result.error) return { error: result.error };

  return { created: true };
}

// Depuis la page Casting : ajoute un profil déjà choisi (base/booking/
// candidature en amont) à un rôle précis.
export async function addFigurantToCastingRole(
  roleId: string,
  figurantId: string,
  opts?: { bookingId?: string | null; candidatureId?: string | null }
): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("id, nom, projet_id, date_tournage, nb_videos, photo_labels, demande_bande_demo, message_corps")
    .eq("id", roleId)
    .maybeSingle<CastingRole>();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  const result = await createEntryAndInvite(role, figurantId, opts);
  if (result.error) return { error: result.error };

  revalidatePath("/casting");
  return { success: true };
}

// Depuis Base Profils / Booking / Candidatures : envoie une sélection de
// profils vers un rôle, en le créant s'il n'existe pas encore sur ce projet
// (comme sendFigurantsToEssayage crée la journée à la volée) — calibration
// par défaut, à affiner ensuite depuis la page Casting.
export async function addFigurantsToCasting(
  figurantIds: string[],
  projetId: string,
  roleNom: string,
  dateTournage: string | null
): Promise<{ error?: string; ok?: number; deja?: number; echecs?: number }> {
  if (figurantIds.length === 0) return { error: "Aucun profil sélectionné." };
  const nom = roleNom.trim();
  if (!nom) return { error: "Le nom du rôle est obligatoire." };

  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: role, error: roleError } = await supabase
    .from("casting_roles")
    .upsert(
      { projet_id: projetId, nom, date_tournage: dateTournage },
      { onConflict: "projet_id,nom", ignoreDuplicates: false }
    )
    .select("id, nom, projet_id, date_tournage, nb_videos, photo_labels, demande_bande_demo, message_corps")
    .single<CastingRole>();
  if (roleError || !role) return { error: roleError?.message ?? "Impossible de créer le rôle." };

  let ok = 0;
  let deja = 0;
  let echecs = 0;
  for (const figurantId of figurantIds) {
    const result = await createEntryAndInvite(role, figurantId);
    if (result.error) echecs += 1;
    else if (result.created) ok += 1;
    else deja += 1;
  }

  revalidatePath("/casting");
  return { ok, deja, echecs };
}

export async function deleteCastingEntry(entryId: string) {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, video_storage_paths")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return;
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) throw new Error(accessError);

  if (entry.video_storage_paths?.length) {
    await supabase.storage.from("casting-videos").remove(entry.video_storage_paths);
  }
  await supabase.from("casting_entries").delete().eq("id", entryId);
  revalidatePath("/casting");
}

export async function recordCastingMessage(
  figurantId: string,
  corps: string,
  email: string | null | undefined,
  subject: string,
  projetId: string | null | undefined
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "casting", email, subject, projetId });
}
