import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Retrouve un profil existant par email, ou envoie une invitation Supabase
// Auth si c'est une adresse jamais vue — utilisé pour inviter des
// assistant·es (par projet) et des chef·fes (par le compte propriétaire).
// Le profil est cherché AVANT d'inviter : inviteUserByEmail renvoie un
// nouvel email à un compte qui n'a pas encore accepté son invitation, d'où
// des invitations reçues en double. Pour relancer volontairement quelqu'un,
// il y a resendChefInvite (console admin).
export async function findOrInviteProfile(
  email: string,
  meta?: Record<string, string>
): Promise<{ id: string | null; invited: boolean; error: string | null }> {
  const admin = createAdminClient();

  const { data: profil } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profil) return { id: profil.id, invited: false, error: null };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/invite`,
    data: meta,
  });
  if (!inviteError && invited.user) {
    return { id: invited.user.id, invited: true, error: null };
  }

  // Compte Auth sans profil (cas rare) : l'invitation est refusée, on
  // retrouve le compte dans la liste.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { id: existing.id, invited: false, error: null };
  }

  return { id: null, invited: false, error: inviteError?.message ?? "Impossible d'inviter cet email." };
}
