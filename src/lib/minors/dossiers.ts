import "server-only";
import { hasSectionAccess } from "@/lib/auth/sections";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile, checkProjetAccess } from "@/lib/auth/session";
import { getGuardiansForVerifiedCandidate } from "@/lib/minors/data";
import { ageOnDate, todayInParis } from "@/lib/minors/model";

export type MinorDossier = { id: string; projet_id: string; figurant_id: string; tournage_debut: string | null; tournage_fin: string | null; commission_date: string | null; role_label: string | null; cachet_info: string | null };
export type MinorDocument = { id: string; dossier_id: string; source_key: string; state: "requested" | "received" | "validated" | "refused"; storage_path: string | null; filename: string | null; valid_until: string | null; internal_note: string | null; guardian_fingerprint: string | null; current_guardian_fingerprint?: string | null; validationCurrent?: boolean };
export type MinorRequirement = { id: string; label: string; required: boolean; active: boolean };
export const MINOR_BUCKET = "minor-documents";
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function staffDossier(id: string) {
  const actor = await getCurrentProfile();
  if (!hasSectionAccess(actor, "/mineurs") || !actor) return null;
  const admin = createAdminClient();
  const { data: dossier, error } = await admin.from("minor_dossiers").select("*").eq("id", id).maybeSingle<MinorDossier>();
  if (error || !dossier || await checkProjetAccess(dossier.projet_id)) return null;
  const { data: child, error: childError } = await (await createServerSupabaseClient()).from("figurants").select("id,prenom,nom,email,date_naissance,adresse,code_postal,ville").eq("id", dossier.figurant_id).maybeSingle();
  if (childError || !child) return null;
  return { actor, dossier, child };
}

export async function dossierContents(dossier: MinorDossier) {
  const admin = createAdminClient();
  const [documents, requirements, guardians, complete, fingerprints] = await Promise.all([
    admin.from("minor_documents").select("*").eq("dossier_id", dossier.id).returns<MinorDocument[]>(),
    admin.from("minor_requirements").select("id,label,required,active").eq("projet_id", dossier.projet_id).eq("active", true).order("created_at").returns<MinorRequirement[]>(),
    getGuardiansForVerifiedCandidate(dossier.figurant_id),
    admin.rpc("minor_dossier_complete", { p_project: dossier.projet_id, p_child: dossier.figurant_id, p_date: dossier.tournage_debut ?? todayInParis() }),
    Promise.all([1, 2].map(position => admin.rpc("minor_guardian_fingerprint", { p_id: dossier.figurant_id, p_position: position }))),
  ]);
  if (documents.error || requirements.error || complete.error || fingerprints.some(result => result.error)) throw new Error("Dossier mineur temporairement indisponible.");
  const reference = dossier.tournage_debut ?? todayInParis();
  const checkedDocuments = (documents.data ?? []).map(document => ({ ...document, current_guardian_fingerprint: document.source_key.startsWith("guardian_") ? fingerprints[document.source_key === "guardian_1" ? 0 : 1].data as string | null : null, validationCurrent: document.state === "validated" && !!document.storage_path && (!document.valid_until || document.valid_until >= reference) && (!document.source_key.startsWith("guardian_") || typeof document.guardian_fingerprint === "string" && document.guardian_fingerprint === fingerprints[document.source_key === "guardian_1" ? 0 : 1].data) }));
  return { documents: checkedDocuments, requirements: requirements.data ?? [], guardians, complete: complete.data === true };
}

// Seuls les appelants ayant déjà vérifié staffDossier ou bearerDossier utilisent ce helper.
export async function signedMinorFile(path: string) {
  const { data, error } = await createAdminClient().storage.from(MINOR_BUCKET).createSignedUrl(path, 60, { download: true });
  return error ? null : data.signedUrl;
}

export async function bearerDossier(token: string, kind: "upload" | "production") {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: link, error } = await admin.from("minor_links").select("id,dossier_id,kind,expires_at,revoked_at,upload_count").eq("token_hash", tokenHash(token)).maybeSingle();
  if (error || !link || link.revoked_at || Date.parse(link.expires_at) <= Date.now()) return null;
  if (kind === "production" ? link.kind !== "production" : !["guardian_1", "guardian_2"].includes(link.kind)) return null;
  const { data: dossier } = await admin.from("minor_dossiers").select("*").eq("id", link.dossier_id).maybeSingle<MinorDossier>();
  if (!dossier) return null;
  const { data: child } = await admin.from("figurants").select("prenom,nom,date_naissance").eq("id", dossier.figurant_id).maybeSingle();
  if (!child) return null;
  return { link, dossier, child, age: ageOnDate(child.date_naissance, dossier.tournage_debut ?? todayInParis()) };
}
