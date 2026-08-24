import type { createAdminClient } from "@/lib/supabase/admin";

export type DocumentTemplate = { logoUrl: string | null; accentColor: string | null };

const EMPTY_TEMPLATE: DocumentTemplate = { logoUrl: null, accentColor: null };

export async function getDocumentTemplate(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined
): Promise<DocumentTemplate> {
  if (!projetId) return EMPTY_TEMPLATE;

  const { data } = await supabase
    .from("document_templates")
    .select("logo_storage_path, accent_color")
    .eq("projet_id", projetId)
    .maybeSingle();

  if (!data) return EMPTY_TEMPLATE;

  const logoUrl = data.logo_storage_path
    ? supabase.storage.from("document-templates").getPublicUrl(data.logo_storage_path).data.publicUrl
    : null;

  return { logoUrl, accentColor: data.accent_color };
}
