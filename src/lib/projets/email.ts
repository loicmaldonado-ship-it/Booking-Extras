import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";

// Résout la boîte Gmail à utiliser pour un envoi lié à ce projet : d'abord
// la config propre au projet (si renseignée), sinon la boîte par défaut de
// la cheffe propriétaire du projet, sinon la boîte partagée globale (voir
// email/send.ts) — pour que chaque cheffe envoie depuis sa propre adresse
// sans avoir à la reconfigurer sur chacun de ses projets.
export async function getProjetEmailCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined
): Promise<{ user: string; pass: string } | null> {
  if (!projetId) return null;

  const { data: projet } = await supabase
    .from("projets")
    .select("gmail_smtp_user, gmail_smtp_app_password, owner_id")
    .eq("id", projetId)
    .maybeSingle();
  if (!projet) return null;

  if (projet.gmail_smtp_user && projet.gmail_smtp_app_password) {
    return { user: projet.gmail_smtp_user, pass: decryptSecret(projet.gmail_smtp_app_password) };
  }

  return getOwnerEmailCredentials(supabase, projet.owner_id);
}

export async function getOwnerEmailCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string | null | undefined
): Promise<{ user: string; pass: string } | null> {
  if (!ownerId) return null;

  const { data: owner } = await supabase
    .from("profiles")
    .select("gmail_smtp_user, gmail_smtp_app_password")
    .eq("id", ownerId)
    .maybeSingle();

  if (!owner?.gmail_smtp_user || !owner?.gmail_smtp_app_password) return null;
  return { user: owner.gmail_smtp_user, pass: decryptSecret(owner.gmail_smtp_app_password) };
}
