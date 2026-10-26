import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";

// Google affiche le mot de passe d'application par groupes de 4
// (« abcd efgh ijkl mnop ») : copié tel quel, il contient des espaces que
// Gmail n'accepte pas forcément. Le vrai mot de passe n'en a jamais.
export function motDePasseApp(saisi: string) {
  return saisi.replace(/\s+/g, "");
}

export type EmailCredentialsResult = { credentials: { user: string; pass: string } | null; error?: string };

// Mot de passe enregistré illisible (clé de chiffrement changée, valeur
// abîmée) : erreur claire plutôt qu'un plantage de l'envoi.
function dechiffrer(user: string, chiffre: string): EmailCredentialsResult {
  try {
    return { credentials: { user, pass: motDePasseApp(decryptSecret(chiffre)) } };
  } catch {
    return {
      credentials: null,
      error: `Le mot de passe d'application enregistré pour ${user} est illisible : ressaisis-le dans les réglages d'envoi.`,
    };
  }
}

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
    return dechiffrer(projet.gmail_smtp_user, projet.gmail_smtp_app_password);
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
    .select("email, gmail_smtp_user, gmail_smtp_app_password, is_owner")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner) return { credentials: null };

  if (owner.gmail_smtp_user && owner.gmail_smtp_app_password) {
    return dechiffrer(owner.gmail_smtp_user, owner.gmail_smtp_app_password);
  }

  if (owner.is_owner) return { credentials: null };

  return {
    credentials: null,
    error: "Configure ta boîte Gmail d'envoi sur la page Équipe avant de pouvoir envoyer des messages.",
  };
}
