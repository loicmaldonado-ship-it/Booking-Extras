import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleProjetIds, idsOrNone, profileDisplayName, type CurrentProfile } from "@/lib/auth/session";
import { isOnline } from "@/lib/auth/presence";
import type { PresenceMember } from "@/components/equipe/team-presence-list";

// Équipe d'une chef·fe = elle-même + les assistant·es invité·es sur l'un de
// ses projets (possédés ou partagés) — même portée que getAccessibleProjetIds,
// réutilisée par la page Équipe et le bandeau de présence du header.
export async function getMyTeamPresence(profile: CurrentProfile): Promise<PresenceMember[]> {
  if (profile.role !== "chef") return [];

  const supabase = createAdminClient();
  const accessibleIds = await getAccessibleProjetIds(profile);

  let membresQuery = supabase
    .from("projet_membres")
    .select("profiles(id, email, nom, prenom, avatar_storage_path, last_seen_at)");
  if (accessibleIds !== null) membresQuery = membresQuery.in("projet_id", idsOrNone(accessibleIds));

  const { data: membresRaw } = await membresQuery.returns<
    { profiles: { id: string; email: string | null; nom: string | null; prenom: string | null; avatar_storage_path: string | null; last_seen_at: string | null } | null }[]
  >();

  const byId = new Map<string, PresenceMember>();
  byId.set(profile.id, {
    id: profile.id,
    nom: profileDisplayName(profile),
    email: profile.email,
    role: "chef",
    avatarUrl: profile.avatarUrl,
    online: true,
  });
  for (const m of membresRaw ?? []) {
    if (!m.profiles || byId.has(m.profiles.id)) continue;
    byId.set(m.profiles.id, {
      id: m.profiles.id,
      nom: profileDisplayName(m.profiles),
      email: m.profiles.email,
      role: "assistant",
      avatarUrl: m.profiles.avatar_storage_path
        ? supabase.storage.from("profile-avatars").getPublicUrl(m.profiles.avatar_storage_path).data.publicUrl
        : null,
      online: isOnline(m.profiles.last_seen_at),
    });
  }

  return Array.from(byId.values());
}
