import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/candidats/password";

// Mots de passe des comptes candidat·es, dans figurant_comptes (jamais dans
// figurants, lue en entier par de nombreuses pages).

export async function definirMotDePasse(figurantId: string, motDePasse: string): Promise<{ error?: string }> {
  const { error } = await createAdminClient()
    .from("figurant_comptes")
    .upsert(
      { figurant_id: figurantId, password_hash: await hashPassword(motDePasse), updated_at: new Date().toISOString() },
      { onConflict: "figurant_id" }
    );
  return error ? { error: error.message } : {};
}

export async function motDePasseCorrect(figurantId: string, motDePasse: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("figurant_comptes")
    .select("password_hash")
    .eq("figurant_id", figurantId)
    .maybeSingle();
  return !!data && (await verifyPassword(motDePasse, data.password_hash));
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
