"use server";

import { getCurrentProfile } from "@/lib/auth/session";
import { getMyTeamPresence } from "@/lib/auth/team-presence";
import type { PresenceMember } from "@/components/equipe/team-presence-list";

// Pour le bandeau du header : le reste de l'équipe, pas soi-même (déjà
// visible via son propre avatar juste à côté).
export async function fetchMyTeamPresence(): Promise<PresenceMember[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const members = await getMyTeamPresence(profile);
  return members.filter((m) => m.id !== profile.id);
}
