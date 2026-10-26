"use server";
import { hasSectionAccess } from "@/lib/auth/sections";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile, checkProjetAccess } from "@/lib/auth/session";
import { staffDossier, bearerDossier, tokenHash, MINOR_BUCKET } from "./dossiers";
import { ageOnDate, readGuardians } from "./model";
import { saveGuardiansFromForm } from "./data";
import { validateImageUpload, validatePdfUpload } from "@/lib/media/validate-upload";
export type MinorResult = { error?: string; success?: string; url?: string };
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const refresh = (project: string) => { revalidatePath(`/projets/${project}/mineurs`); revalidatePath("/bookings"); };

export async function createMinorDossier(project: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  if (!uuid(project) || !hasSectionAccess(await getCurrentProfile(), "/mineurs") || await checkProjetAccess(project)) return { error: "Non autorisé." };
  const childId = str(fd, "figurant_id");
  if (!uuid(childId)) return { error: "Choisis un profil mineur." };
  const { data: child } = await (await createServerSupabaseClient()).from("figurants").select("date_naissance").eq("id", childId).maybeSingle();
  const age = ageOnDate(child?.date_naissance);
  if (age === null || age >= 18) return { error: "Le profil doit avoir une date de naissance connue et être mineur." };
  const { error } = await createAdminClient().from("minor_dossiers").upsert({ projet_id: project, figurant_id: childId }, { onConflict: "projet_id,figurant_id", ignoreDuplicates: true });
  if (error) return { error: "Création du dossier impossible." };
  refresh(project); redirect(`/projets/${project}/mineurs?enfant=${childId}`);
}

export async function saveMinorDates(id: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  const access = await staffDossier(id); if (!access) return { error: "Non autorisé." };
  const start = str(fd, "tournage_debut"), end = str(fd, "tournage_fin"), commission = str(fd, "commission_date");
  const valid = (v: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (![start, end, commission].every(valid) || (start && end && end < start)) return { error: "Dates invalides ou période inversée." };
  const role = str(fd, "role_label"), fee = str(fd, "cachet_info");
  if (role.length > 200 || fee.length > 400) return { error: "Fonction ou conditions de rémunération trop longues." };
  const { error } = await createAdminClient().from("minor_dossiers").update({ role_label: role || null, cachet_info: fee || null, tournage_debut: start || null, tournage_fin: end || null, commission_date: commission || null }).eq("id", id);
  if (error) return { error: "Dates non enregistrées." }; refresh(access.dossier.projet_id); return { success: "Dates enregistrées." };
}

export async function saveMinorGuardians(id: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  const access = await staffDossier(id); if (!access) return { error: "Non autorisé." };
  if (!access.child.date_naissance || !access.child.email) return { error: "Complète d’abord la naissance et l’email de l’enfant dans sa fiche." };
  const parsed = readGuardians(fd, access.child.date_naissance, access.child.email);
  if ("error" in parsed) return parsed;
  const result = await saveGuardiansFromForm(access.dossier.figurant_id, fd, access.child.date_naissance, access.child.email);
  if (result.error) return result; refresh(access.dossier.projet_id); revalidatePath("/compte"); return { success: "Représentants enregistrés. Toute autorisation portant sur d’anciennes coordonnées doit être revalidée." };
}

export async function addMinorRequirement(project: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  if (!uuid(project) || !hasSectionAccess(await getCurrentProfile(), "/mineurs") || await checkProjetAccess(project)) return { error: "Non autorisé." };
  const label = str(fd, "label"); if (!label || label.length > 200) return { error: "Intitulé obligatoire, 200 caractères maximum." };
  const { error } = await createAdminClient().from("minor_requirements").insert({ projet_id: project, label, required: fd.get("required") === "on" });
  if (error) return { error: "Pièce non ajoutée." }; refresh(project); return { success: "Pièce ajoutée aux dossiers de ce projet." };
}

export async function deactivateMinorRequirement(project: string, id: string): Promise<MinorResult> {
  if (!uuid(project) || !uuid(id) || !hasSectionAccess(await getCurrentProfile(), "/mineurs") || await checkProjetAccess(project)) return { error: "Non autorisé." };
  const { error, data } = await createAdminClient().from("minor_requirements").update({ active: false }).eq("id", id).eq("projet_id", project).select("id").maybeSingle();
  if (error || !data) return { error: "Pièce introuvable ou non modifiée." }; refresh(project); return { success: "Pièce retirée des exigences, anciens fichiers conservés." };
}

export async function createMinorLink(id: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  const access = await staffDossier(id); if (!access) return { error: "Non autorisé." };
  const kind = str(fd, "kind"); if (!["guardian_1", "guardian_2", "production"].includes(kind)) return { error: "Type de lien invalide." };
  const token = randomBytes(32).toString("hex");
  const { error } = await createAdminClient().from("minor_links").insert({ dossier_id: id, token_hash: tokenHash(token), kind });
  if (error) return { error: "Lien non créé." };
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/mineurs/${kind === "production" ? "partage" : "depot"}/${token}`;
  refresh(access.dossier.projet_id); return { success: "Lien créé pour 7 jours. Il donne accès à ce dossier uniquement ; transmets-le au destinataire prévu.", url };
}

export async function revokeMinorLinks(id: string): Promise<MinorResult> {
  const access = await staffDossier(id); if (!access) return { error: "Non autorisé." };
  const { error } = await createAdminClient().from("minor_links").update({ revoked_at: new Date().toISOString() }).eq("dossier_id", id).is("revoked_at", null);
  if (error) return { error: "Révocation impossible." }; refresh(access.dossier.projet_id); return { success: "Tous les liens du dossier sont révoqués." };
}

export async function reviewMinorDocument(dossierId: string, documentId: string, expectedPath: string | null, expectedGuardian: string | null, _prev: unknown, fd: FormData): Promise<MinorResult> {
  const access = await staffDossier(dossierId); if (!access) return { error: "Non autorisé." };
  const admin = createAdminClient();
  const { data: document } = await admin.from("minor_documents").select("id").eq("id", documentId).eq("dossier_id", dossierId).maybeSingle();
  if (!document) return { error: "Pièce introuvable." };
  const state = str(fd, "state"), until = str(fd, "valid_until"), note = str(fd, "internal_note");
  if (note.length > 2000) return { error: "Commentaire limité à 2 000 caractères." };
  if (!["validated", "refused", "received"].includes(state) || until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: "Statut ou expiration invalide." };
  const { error } = await admin.rpc("review_minor_document", { p_document: documentId, p_state: state, p_until: until || null, p_actor: access.actor.id, p_note: note || null, p_expected_path: expectedPath, p_expected_guardian: expectedGuardian });
  if (error) return { error: "Vérification non enregistrée. Recharge le dossier : le fichier ou les représentants ont pu changer. Un fichier est obligatoire pour valider." }; refresh(access.dossier.projet_id); return { success: "Vérification enregistrée." };
}

export async function deleteMinorDocument(dossierId: string, documentId: string): Promise<MinorResult> {
  const access = await staffDossier(dossierId); if (!access) return { error: "Non autorisé." };
  const admin = createAdminClient();
  const { data: document } = await admin.from("minor_documents").select("storage_path").eq("id", documentId).eq("dossier_id", dossierId).maybeSingle();
  if (!document?.storage_path) return { error: "Fichier introuvable." };
  const { data, error } = await admin.from("minor_documents").update({ storage_path: null, filename: null, mime_type: null, state: "requested", internal_note: null, reviewed_at: null, reviewed_by: null, guardian_fingerprint: null, valid_until: null }).eq("id", documentId).eq("dossier_id", dossierId).eq("storage_path", document.storage_path).select("id").maybeSingle();
  if (error || !data) return { error: "La pièce a changé. Recharge le dossier avant de réessayer." };
  const removed = await admin.storage.from(MINOR_BUCKET).remove([document.storage_path]);
  refresh(access.dossier.projet_id);
  if (removed.error) return { error: "Pièce retirée du dossier et validation annulée ; le nettoyage du stockage reste à reprendre." };
  return { success: "Fichier supprimé, pièce à nouveau manquante." };
}

export async function uploadMinorDocument(token: string, _prev: unknown, fd: FormData): Promise<MinorResult> {
  const access = await bearerDossier(token, "upload"); if (!access) return { error: "Lien invalide, révoqué ou expiré." };
  const key = str(fd, "source_key"), file = fd.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return { error: "Choisis un PDF ou une photo de 10 Mo maximum." };
  const validation = file.type === "application/pdf" ? await validatePdfUpload(file, 10 * 1024 * 1024) : await validateImageUpload(file, 10 * 1024 * 1024);
  if (validation.error) return { error: validation.error };
  const admin = createAdminClient();
  const { data: dossierId, error: quotaError } = await admin.rpc("consume_minor_upload", { p_hash: tokenHash(token), p_key: key });
  if (quotaError || dossierId !== access.dossier.id) return { error: "Dépôt non autorisé ou limite de dépôts atteinte. Demande un nouveau lien à l’équipe." };
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${access.dossier.id}/${randomUUID()}.${ext}`;
  const { error: storageError } = await admin.storage.from(MINOR_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return { error: "Le fichier n’a pas pu être déposé. Réessaie." };
  const { data: previousPath, error } = await admin.rpc("commit_minor_upload", { p_hash: tokenHash(token), p_key: key, p_path: path, p_filename: file.name.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0, 200), p_mime: file.type });
  if (error) { await admin.storage.from(MINOR_BUCKET).remove([path]); return { error: "Le lien a expiré ou changé pendant le dépôt. Le fichier n’a pas été ajouté au dossier." }; }
  if (previousPath) {
    const { error: cleanupError } = await admin.storage.from(MINOR_BUCKET).remove([previousPath]);
    if (cleanupError) console.error("Nettoyage d’une ancienne pièce mineur à reprendre", access.dossier.id);
  }
  refresh(access.dossier.projet_id); revalidatePath(`/mineurs/depot/${token}`);
  return { success: "Fichier reçu. L’équipe doit encore vérifier son contenu et sa signature." };
}
