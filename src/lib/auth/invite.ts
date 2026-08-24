import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Retrouve un profil existant par email, ou envoie une invitation Supabase
// Auth si c'est une adresse jamais vue — utilisé pour inviter des
// assistant·es (par projet) et des chef·fes (par le compte propriétaire).
export async function findOrInviteProfile(
  email: string,
  meta?: Record<string, string>
): Promise<{ id: string | null; error: string | null }> {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/invite`,
    data: meta,
  });
  if (!inviteError && invited.user) {
    return { id: invited.user.id, error: null };
  }

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { id: existing.id, error: null };
  }

  return { id: null, error: inviteError?.message ?? "Impossible d'inviter cet email." };
}
