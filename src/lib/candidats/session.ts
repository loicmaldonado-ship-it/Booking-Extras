import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "figurant_session";

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
    .select("id, prenom, nom, email")
    .eq("id", session.figurant_id)
    .maybeSingle();

  return figurant ?? null;
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
