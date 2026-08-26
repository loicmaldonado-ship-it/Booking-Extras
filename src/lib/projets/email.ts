import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";
import { isOwner } from "@/lib/auth/owner";

export type EmailCredentialsResult = { credentials: { user: string; pass: string } | null; error?: string };

// Résout la boîte Gmail à utiliser pour un envoi lié à ce projet : d'abord
// la config propre au projet (si renseignée), sinon la boîte par défaut de
// la cheffe propriétaire du projet. Si ni l'un ni l'autre n'est configuré,
// la boîte partagée globale ne sert de secours que pour le compte
// propriétaire de l'agence — toute autre cheffe DOIT configurer sa boîte
// (sur /equipe ou sur le projet) avant de pouvoir envoyer quoi que ce soit,
// pour ne jamais faire partir un message "depuis" une adresse qui n'est pas
// la sienne.
export async function getProjetEmailCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined
): Promise<EmailCredentialsResult> {
  if (!projetId) return { credentials: null };

  const { data: projet } = await supabase
    .from("projets")
    .select("gmail_smtp_user, gmail_smtp_app_password, owner_id")
    .eq("id", projetId)
    .maybeSingle();
  if (!projet) return { credentials: null };

  if (projet.gmail_smtp_user && projet.gmail_smtp_app_password) {
    return { credentials: { user: projet.gmail_smtp_user, pass: decryptSecret(projet.gmail_smtp_app_password) } };
  }

  return getOwnerEmailCredentials(supabase, projet.owner_id);
}

export async function getOwnerEmailCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string | null | undefined
): Promise<EmailCredentialsResult> {
  if (!ownerId) return { credentials: null };

  const { data: owner } = await supabase
    .from("profiles")
    .select("email, gmail_smtp_user, gmail_smtp_app_password")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner) return { credentials: null };

  if (owner.gmail_smtp_user && owner.gmail_smtp_app_password) {
    return { credentials: { user: owner.gmail_smtp_user, pass: decryptSecret(owner.gmail_smtp_app_password) } };
  }

  if (isOwner({ email: owner.email })) return { credentials: null };

  return {
    credentials: null,
    error: "Configure ta boîte Gmail d'envoi sur la page Équipe avant de pouvoir envoyer des messages.",
  };
}
