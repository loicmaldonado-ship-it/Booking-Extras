"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/media/validate-upload";
import { checkProjetAccess } from "@/lib/auth/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

// Le logo est optionnel à chaque enregistrement : ne pas en fournir un
// nouveau conserve celui déjà en place (ex. on ne change que la couleur).
export async function updateDocumentTemplate(projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const accentColor = str(formData, "accent_color");
  const logo = formData.get("logo");

  const supabase = createAdminClient();

  const payload: { projet_id: string; accent_color: string | null; logo_storage_path?: string } = {
    projet_id: projetId,
    accent_color: accentColor,
  };

  if (logo instanceof File && logo.size > 0) {
    const validated = await validateImageUpload(logo);
    if (validated.error) return { error: validated.error };
    const ext = validated.extension;
    const path = `${projetId}/logo-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("document-templates")
      .upload(path, logo, { contentType: validated.mimeType, upsert: false });
    if (uploadError) return { error: uploadError.message };
    payload.logo_storage_path = path;
  }

  const { error } = await supabase
    .from("document_templates")
    .upsert(payload, { onConflict: "projet_id" });
  if (error) {
    if (payload.logo_storage_path) await supabase.storage.from("document-templates").remove([payload.logo_storage_path]);
    return { error: error.message };
  }

  revalidatePath(`/projets/${projetId}`);
  return { success: true as const };
}

export async function removeDocumentTemplateLogo(projetId: string) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("document_templates")
    .update({ logo_storage_path: null })
    .eq("projet_id", projetId);
  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}`);
  return { success: true as const };
}
