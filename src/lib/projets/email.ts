import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";

// Résout l'éventuel compte Gmail dédié d'un projet — si les deux champs ne
// sont pas remplis, on retombe sur la boîte partagée par défaut (voir
// email/send.ts).
export async function getProjetEmailCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined
): Promise<{ user: string; pass: string } | null> {
  if (!projetId) return null;

  const { data } = await supabase
    .from("projets")
    .select("gmail_smtp_user, gmail_smtp_app_password")
    .eq("id", projetId)
    .maybeSingle();

  if (!data?.gmail_smtp_user || !data?.gmail_smtp_app_password) return null;
  return { user: data.gmail_smtp_user, pass: decryptSecret(data.gmail_smtp_app_password) };
}
