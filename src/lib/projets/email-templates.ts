import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailTemplateKey = "espace_perso" | "magic_link";

const COLUMN: Record<EmailTemplateKey, "email_espace_perso_template" | "email_magic_link_template"> = {
  espace_perso: "email_espace_perso_template",
  magic_link: "email_magic_link_template",
};

// Résout le modèle d'email calibré par la cheffe propriétaire du projet
// (Équipe → mails automatiques) — vide/absent = texte par défaut généré
// par l'appli, comme message_corps sur les rôles de casting.
export async function getEmailTemplate(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined,
  key: EmailTemplateKey
): Promise<string | null> {
  if (!projetId) return null;

  const { data: projet } = await supabase.from("projets").select("owner_id").eq("id", projetId).maybeSingle();
  if (!projet?.owner_id) return null;

  const { data: owner } = await supabase
    .from("profiles")
    .select(COLUMN[key])
    .eq("id", projet.owner_id)
    .maybeSingle<Record<string, string | null>>();

  return owner?.[COLUMN[key]] ?? null;
}

export function applyEmailTemplate(template: string, vars: { prenom: string; lien: string }): string {
  return template.replace(/\{prenom\}/g, vars.prenom).replace(/\{lien\}/g, vars.lien);
}
