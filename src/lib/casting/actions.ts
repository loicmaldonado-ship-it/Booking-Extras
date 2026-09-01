"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import type { CategorieCachet, CastingMode } from "./types";
import type { BookingStatut } from "@/lib/bookings/types";

function parsePhotoLabels(formData: FormData): string[] {
  return formData
    .getAll("photo_label")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function parseCategorieCachet(formData: FormData): CategorieCachet {
  const v = String(formData.get("categorie_cachet") ?? "");
  return v === "silhouette" || v === "doublure" ? v : "role";
}

function parseCastingMode(formData: FormData): CastingMode {
  return String(formData.get("mode") ?? "") === "presentiel" ? "presentiel" : "selftape";
}

// Le PDF (ex. extrait de script) est un fichier déjà prêt qu'on upload tel
// quel — pas de génération, juste un stockage + jointure au mail à l'envoi.
async function uploadRolePdfIfProvided(
  supabase: ReturnType<typeof createAdminClient>,
  roleId: string,
  formData: FormData
): Promise<{ error?: string; pdf_storage_path?: string; pdf_filename?: string }> {
  const pdf = formData.get("pdf");
  if (!(pdf instanceof File) || pdf.size === 0) return {};
  if (pdf.type !== "application/pdf") return { error: "Le fichier joint doit être un PDF." };

  const path = `${roleId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from("casting-role-documents").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) return { error: error.message };

  return { pdf_storage_path: path, pdf_filename: pdf.name };
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
  const categorieCachet = parseCategorieCachet(formData);
  const mode = parseCastingMode(formData);
  const nbVideos = Math.max(0, Number(formData.get("nb_videos") ?? 1) || 0);
  const photoLabels = parsePhotoLabels(formData);
  const demandeBandeDemo = formData.get("demande_bande_demo") === "on";
  const messageCorps = String(formData.get("message_corps") ?? "").trim() || null;
  const visiblePartage = formData.get("visible_partage") === "on";

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("casting_roles")
    .insert({
      projet_id: projetId,
      nom,
      date_tournage: dateTournage,
      categorie_cachet: categorieCachet,
      mode,
      nb_videos: nbVideos,
      photo_labels: photoLabels,
      demande_bande_demo: demandeBandeDemo,
      message_corps: messageCorps,
      visible_partage: visiblePartage,
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "Un rôle avec ce nom existe déjà sur ce projet." : error.message };

  const pdfResult = await uploadRolePdfIfProvided(supabase, inserted.id, formData);
  if (pdfResult.error) return { error: pdfResult.error };
  if (pdfResult.pdf_storage_path) {
    await supabase
      .from("casting_roles")
      .update({ pdf_storage_path: pdfResult.pdf_storage_path, pdf_filename: pdfResult.pdf_filename })
      .eq("id", inserted.id);
  }

  revalidatePath("/casting");
  return { success: true };
}

export async function updateCastingRoleCalibration(
  roleId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("projet_id, pdf_storage_path")
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom du rôle est obligatoire." };

  const dateTournage = String(formData.get("date_tournage") ?? "").trim() || null;
  const categorieCachet = parseCategorieCachet(formData);
  const mode = parseCastingMode(formData);
  const nbVideos = Math.max(0, Number(formData.get("nb_videos") ?? 1) || 0);
  const photoLabels = parsePhotoLabels(formData);
  const demandeBandeDemo = formData.get("demande_bande_demo") === "on";
  const messageCorps = String(formData.get("message_corps") ?? "").trim() || null;
  const visiblePartage = formData.get("visible_partage") === "on";

  const removePdf = formData.get("remove_pdf") === "on";
  const pdfResult = await uploadRolePdfIfProvided(supabase, roleId, formData);
  if (pdfResult.error) return { error: pdfResult.error };

  const pdfPatch: { pdf_storage_path?: string | null; pdf_filename?: string | null } = {};
  if (pdfResult.pdf_storage_path) {
    if (role.pdf_storage_path) await supabase.storage.from("casting-role-documents").remove([role.pdf_storage_path]);
    pdfPatch.pdf_storage_path = pdfResult.pdf_storage_path;
    pdfPatch.pdf_filename = pdfResult.pdf_filename;
  } else if (removePdf && role.pdf_storage_path) {
    await supabase.storage.from("casting-role-documents").remove([role.pdf_storage_path]);
    pdfPatch.pdf_storage_path = null;
    pdfPatch.pdf_filename = null;
  }

  const { error } = await supabase
    .from("casting_roles")
    .update({
      nom,
      date_tournage: dateTournage,
      categorie_cachet: categorieCachet,
      mode,
      nb_videos: nbVideos,
      photo_labels: photoLabels,
      demande_bande_demo: demandeBandeDemo,
      message_corps: messageCorps,
      visible_partage: visiblePartage,
      ...pdfPatch,
    })
    .eq("id", roleId);
  if (error) return { error: error.code === "23505" ? "Un rôle avec ce nom existe déjà sur ce projet." : error.message };

  revalidatePath("/casting");
  return { success: true };
}

export async function deleteCastingRole(roleId: string) {
  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("projet_id, pdf_storage_path")
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return;
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) throw new Error(accessError);

  const { data: entries } = await supabase.from("casting_entries").select("video_storage_paths").eq("role_id", roleId);
  const allPaths = (entries ?? []).flatMap((e) => e.video_storage_paths ?? []);
  if (allPaths.length > 0) await supabase.storage.from("casting-videos").remove(allPaths);
  if (role.pdf_storage_path) await supabase.storage.from("casting-role-documents").remove([role.pdf_storage_path]);

  await supabase.from("casting_roles").delete().eq("id", roleId);
  revalidatePath("/casting");
}

// Crée juste l'entrée (avec son request_token) — n'envoie plus rien : le
// mail d'invitation part à la main, calibré dans le composeur de message du
// rôle (avec le token {lien}), pas automatiquement à l'ajout.
async function createCastingEntry(
  roleId: string,
  projetId: string,
  figurantId: string,
  entryMode: CastingMode,
  opts?: { bookingId?: string | null; candidatureId?: string | null }
): Promise<{ error?: string; created?: boolean }> {
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("email, est_comedien")
    .eq("id", figurantId)
    .maybeSingle();
  if (!figurant) return { error: "Profil introuvable." };
  // Un profil comédien·ne peut ne pas encore avoir d'email direct (on
  // passe par l'agent, ou l'info arrive plus tard) — pas de blocage ici.
  if (!figurant.email && !figurant.est_comedien) return { error: "Ce profil n'a pas d'email renseigné." };

  const { data: existing } = await supabase
    .from("casting_entries")
    .select("id")
    .eq("role_id", roleId)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (existing) return { created: false };

  const { error } = await supabase.from("casting_entries").insert({
    projet_id: projetId,
    role_id: roleId,
    figurant_id: figurantId,
    mode: entryMode,
    booking_id: opts?.bookingId ?? null,
    candidature_id: opts?.candidatureId ?? null,
  });
  if (error) return { error: error.message };

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
  const { data: role } = await supabase.from("casting_roles").select("projet_id, mode").eq("id", roleId).maybeSingle();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  const result = await createCastingEntry(roleId, role.projet_id, figurantId, role.mode as CastingMode, opts);
  if (result.error) return { error: result.error };

  revalidatePath("/casting");
  return { success: true };
}

// Depuis Base Profils / Booking / Candidatures : liste les rôles déjà
// calibrés sur un projet, pour choisir lequel recevra la sélection — la
// date de tournage et le reste de la calibration restent réservés à la
// création du rôle depuis /casting, pas re-demandés ici.
export async function listCastingRolesForProjet(
  projetId: string
): Promise<{ error?: string; roles?: { id: string; nom: string; categorie_cachet: CategorieCachet }[] }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_roles")
    .select("id, nom, categorie_cachet")
    .eq("projet_id", projetId)
    .order("nom");

  return { roles: data ?? [] };
}

// Envoie une sélection de profils vers un rôle EXISTANT (choisi dans un
// déroulant côté UI) — plus de création de rôle à la volée par nom libre,
// qui pouvait dupliquer un rôle par faute de frappe ou écraser sa date de
// tournage déjà calibrée.
export async function addFigurantsToCastingRole(
  figurantIds: string[],
  roleId: string
): Promise<{ error?: string; ok?: number; deja?: number; echecs?: number }> {
  if (figurantIds.length === 0) return { error: "Aucun profil sélectionné." };

  const supabase = createAdminClient();
  const { data: role } = await supabase.from("casting_roles").select("projet_id, mode").eq("id", roleId).maybeSingle();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  let ok = 0;
  let deja = 0;
  let echecs = 0;
  for (const figurantId of figurantIds) {
    const result = await createCastingEntry(roleId, role.projet_id, figurantId, role.mode as CastingMode);
    if (result.error) echecs += 1;
    else if (result.created) ok += 1;
    else deja += 1;
  }

  revalidatePath("/casting");
  return { ok, deja, echecs };
}

export async function updateCastingEntryMode(entryId: string, mode: CastingMode): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const { error } = await supabase.from("casting_entries").update({ mode }).eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}

export async function updateCastingEntryNotes(entryId: string, notes: string): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const { error } = await supabase.from("casting_entries").update({ notes: notes.trim() || null }).eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}

// Interrupteur indépendant du statut : "le réal peut voir ce profil sur le
// lien de partage" — jamais activé automatiquement à l'envoi, pour laisser
// le temps d'une relecture (voir finalizeCastingUpload).
export async function updateCastingEntryVisiblePartage(
  entryId: string,
  visible: boolean
): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const { error } = await supabase.from("casting_entries").update({ visible_partage: visible }).eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}

// Changement de statut groupé — depuis une sélection multiple sur la page
// Casting, plutôt que profil par profil.
export async function updateCastingEntriesStatutBulk(
  entryIds: string[],
  statut: BookingStatut
): Promise<{ error?: string; ok?: number }> {
  if (entryIds.length === 0) return { error: "Aucun profil sélectionné." };

  const supabase = createAdminClient();
  const { data: entries } = await supabase.from("casting_entries").select("id, projet_id").in("id", entryIds);
  const projetIds = Array.from(new Set((entries ?? []).map((e) => e.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  const { error } = await supabase.from("casting_entries").update({ statut }).in("id", entryIds);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { ok: entryIds.length };
}

export async function updateCastingEntryStatut(entryId: string, statut: BookingStatut): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("casting_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const { error } = await supabase.from("casting_entries").update({ statut }).eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
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

// Retire une photo envoyée par le candidat (staff seulement) — pour laisser
// la place à un remplacement via addCastingPhoto, ex. si la photo envoyée
// est floue ou ne correspond pas au libellé demandé.
export async function deleteCastingPhoto(photoId: string) {
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("figurant_photos")
    .select("storage_path, casting_entry_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo?.casting_entry_id) return;

  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id")
    .eq("id", photo.casting_entry_id)
    .maybeSingle();
  if (!entry) return;
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) throw new Error(accessError);

  await supabase.storage.from("figurant-photos").remove([photo.storage_path]);
  await supabase.from("figurant_photos").delete().eq("id", photoId);
  revalidatePath("/casting");
}

// Ajoute (ou remplace, une fois l'ancienne retirée) une photo pour un
// libellé donné, à la place du candidat — staff seulement, upload direct
// via Server Action (photos toujours petites, pas de risque de timeout).
export async function addCastingPhoto(
  entryId: string,
  label: string,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, figurant_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choisis une image." };

  const ext = photo.name.split(".").pop() || "jpg";
  const path = `${entry.figurant_id}/casting-${label}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("figurant-photos")
    .upload(path, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("figurant_photos").insert({
    figurant_id: entry.figurant_id,
    type: "casting",
    storage_path: path,
    projet_id: entry.projet_id,
    casting_entry_id: entryId,
    label,
  });
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}

// Retire une vidéo précise d'une entrée (staff seulement) — le candidat
// peut en avoir envoyé plusieurs si le rôle en demandait plusieurs.
export async function removeCastingVideo(entryId: string, path: string) {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, video_storage_paths")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return;
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) throw new Error(accessError);

  await supabase.storage.from("casting-videos").remove([path]);
  const remaining = (entry.video_storage_paths ?? []).filter((p: string) => p !== path);
  await supabase.from("casting_entries").update({ video_storage_paths: remaining }).eq("id", entryId);
  revalidatePath("/casting");
}

// Prépare un envoi direct navigateur -> Storage pour une vidéo de
// remplacement (staff seulement) — même mécanisme que le formulaire
// candidat (createCastingUploadSlot), pour ne pas re-timeout sur une vidéo
// lourde envoyée depuis la fonction serveur.
export async function createStaffCastingVideoSlot(
  entryId: string
): Promise<{ bucket?: string; path?: string; token?: string; error?: string }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, figurant_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const path = `${entry.figurant_id}/${entryId}-video-${crypto.randomUUID()}.mp4`;
  const { data, error } = await supabase.storage.from("casting-videos").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Impossible de préparer l'envoi." };

  return { bucket: "casting-videos", path: data.path, token: data.token };
}

// Finalise l'ajout de la vidéo une fois le fichier envoyé à Storage via le
// slot signé ci-dessus.
export async function addCastingVideo(entryId: string, path: string): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("casting_entries")
    .select("projet_id, video_storage_paths")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Introuvable." };
  const accessError = await checkProjetAccess(entry.projet_id);
  if (accessError) return { error: accessError };

  const paths = [...(entry.video_storage_paths ?? []), path];
  const { error } = await supabase.from("casting_entries").update({ video_storage_paths: paths }).eq("id", entryId);
  if (error) return { error: error.message };

  revalidatePath("/casting");
  return { success: true };
}

export async function recordCastingMessage(
  figurantId: string,
  corps: string,
  email: string | null | undefined,
  subject: string,
  projetId: string | null | undefined,
  opts?: { agentEmail?: string | null; rolePdfPath?: string | null; rolePdfFilename?: string | null; html?: string }
) {
  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (opts?.rolePdfPath) {
    const supabase = createAdminClient();
    const { data } = await supabase.storage.from("casting-role-documents").download(opts.rolePdfPath);
    if (data) {
      attachments = [{ filename: opts.rolePdfFilename ?? "document.pdf", content: Buffer.from(await data.arrayBuffer()) }];
    }
  }

  return recordFigurantMessage({
    figurantId,
    corps,
    categorie: "casting",
    email,
    cc: opts?.agentEmail,
    html: opts?.html,
    subject,
    projetId,
    attachments,
  });
}
