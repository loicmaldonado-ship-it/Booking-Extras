import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

const COOKIE_NAME = "figurant_session";
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CandidatSession = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
};

// Projet de la dernière candidature (sinon du dernier booking) : rattache
// la notification "compte créé" à l'équipe qui suit cette personne, au lieu
// de la montrer (et la marquer lue) chez toutes les cheffes.
async function dernierProjetDuFigurant(figurantId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: candidature } = await supabase
    .from("candidatures")
    .select("annonces(projet_id)")
    .eq("figurant_id", figurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ annonces: { projet_id: string } | null }>();
  if (candidature?.annonces?.projet_id) return candidature.annonces.projet_id;
  const { data: booking } = await supabase
    .from("bookings")
    .select("projet_id")
    .eq("figurant_id", figurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return booking?.projet_id ?? null;
}

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
        projetId: await dernierProjetDuFigurant(figurant.id),
        lien: `/figurants/${figurant.id}`,
      });
    }
  }

  return { id: figurant.id, prenom: figurant.prenom, nom: figurant.nom, email: figurant.email };
}

// Crée une session (table + cookie) pour un·e figurant·e déjà identifié·e —
// même mécanique que la vérification du lien magique
// (src/app/compte/verifier/route.ts), réutilisée telle quelle après une
// candidature ou une connexion par mot de passe, pour ne pas dupliquer la
// génération de token / durée de session à plusieurs endroits.
export async function createFigurantSession(figurantId: string): Promise<void> {
  const supabase = createAdminClient();
  const token = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await supabase.from("figurant_sessions").insert({ figurant_id: figurantId, token, expires_at: expiresAt.toISOString() });
  await setFigurantSessionCookie(token, expiresAt);
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
