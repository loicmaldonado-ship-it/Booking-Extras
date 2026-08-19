"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile, getAccessibleProjetIds } from "@/lib/auth/session";

const COOKIE_NAME = "current_projet_id";

export async function getCurrentProjetId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

// Reste le projet actif tant qu'on ne le change pas explicitement, pour ne
// pas mélanger les projets quand on jongle entre plusieurs tournages.
// Vérifie l'accès (un·e assistant·e ne peut activer qu'un projet où elle a
// été invitée) même si l'UI ne devrait normalement proposer que ceux-là.
export async function setCurrentProjet(projetId: string, redirectTo = "/bookings") {
  const profile = await getCurrentProfile();
  if (profile) {
    const accessibleIds = await getAccessibleProjetIds(profile);
    if (accessibleIds !== null && !accessibleIds.includes(projetId)) {
      redirect("/bookings?switch=1");
    }
  }

  const store = await cookies();
  store.set(COOKIE_NAME, projetId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(redirectTo);
}

export async function clearCurrentProjet() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect("/bookings");
}
