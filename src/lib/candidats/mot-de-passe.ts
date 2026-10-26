import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/candidats/password";

// Mots de passe des comptes candidat·es, dans figurant_comptes (jamais dans
// figurants, lue en entier par de nombreuses pages).

export async function definirMotDePasse(figurantId: string, motDePasse: string, renewSession = false, currentToken?: string): Promise<{ error?: string; session?: { token: string; expiresAt: string } }> {
  const { data, error } = await createAdminClient()
    .rpc("changer_mot_de_passe_candidat", { p_id: figurantId, p_hash: await hashPassword(motDePasse), p_creer_session: renewSession, p_current_token: currentToken ?? null });
  if (error) return { error: "Modification du mot de passe impossible. Réessaie." };
  if (renewSession) {
    if (!data?.token || !data?.expires_at) return { error: "Session non créée. Reconnecte-toi avec le nouveau mot de passe." };
    return { session: { token: data.token, expiresAt: data.expires_at } };
  }
  return {};
}

export async function motDePasseCorrect(figurantId: string, motDePasse: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("figurant_comptes")
    .select("password_hash")
    .eq("figurant_id", figurantId)
    .maybeSingle();
  // Même coût scrypt si le compte n’existe pas : évite une fuite de présence par chronométrage.
  const dummy = "06f49f5d2d8223a96f38abafaefc2919:9e1542dc0918657e0eab7b090c2bea4152532f59e3bdb0b2431b2a2944a2660d288ae6ced798f80c2de49290b93ed5cfe6c5a1c36573f421a6b862e7eeb32cb0";
  const valid = await verifyPassword(motDePasse, data?.password_hash ?? dummy);
  return !!data && valid;
}

// Personnes ayant créé leur compte elles-mêmes (mot de passe) : elles se
// connectent seules, le lien « espace » ne sert qu'aux profils ajoutés à
// la main.
export async function aCreeSonCompte(figurantId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("figurant_comptes")
    .select("figurant_id")
    .eq("figurant_id", figurantId)
    .maybeSingle();
  return !!data;
}
