import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aCreeSonCompte } from "@/lib/candidats/mot-de-passe";

const TOKEN_RE = /^[0-9a-f]{32}$/;

// Lien « Crée ton compte » encore utilisable (ni expiré, ni déjà servi).
export async function invitationValide(token: string): Promise<{
  id: string;
  figurantId: string;
  prenom: string;
  email: string | null;
  compteExistant: boolean;
} | null> {
  if (!TOKEN_RE.test(token)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("figurant_auth_tokens")
    .select("id, figurant_id, expires_at, used_at, figurants(prenom, email)")
    .eq("token", token)
    .eq("objet", "creation_compte")
    .maybeSingle<{
      id: string;
      figurant_id: string;
      expires_at: string;
      used_at: string | null;
      figurants: { prenom: string; email: string | null } | null;
    }>();
  if (!data?.figurants || data.used_at || new Date(data.expires_at) < new Date()) return null;
  return {
    id: data.id,
    figurantId: data.figurant_id,
    prenom: data.figurants.prenom,
    email: data.figurants.email,
    compteExistant: await aCreeSonCompte(data.figurant_id),
  };
}
