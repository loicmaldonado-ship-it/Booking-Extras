import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

const COOKIE_NAME = "figurant_session";
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type CandidatSession = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
};

export async function getCurrentFigurant(): Promise<CandidatSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("figurant_sessions")
    .select("figurant_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, nom, email, last_seen_at")
    .eq("id", session.figurant_id)
    .maybeSingle();

  if (!figurant) return null;

  const lastSeen = figurant.last_seen_at ? new Date(figurant.last_seen_at) : null;
  const isStale = !lastSeen || Date.now() - lastSeen.getTime() > LAST_SEEN_THROTTLE_MS;
  if (isStale) {
    await supabase.from("figurants").update({ last_seen_at: new Date().toISOString() }).eq("id", figurant.id);
    if (!lastSeen) {
      await createNotification("compte_cree", `${figurant.prenom} ${figurant.nom} a créé son compte`, {
        figurantId: figurant.id,
        lien: `/figurants/${figurant.id}`,
      });
    }
  }

  return { id: figurant.id, prenom: figurant.prenom, nom: figurant.nom, email: figurant.email };
}

export async function setFigurantSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
  });
}

export async function clearFigurantSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
