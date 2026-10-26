"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFigurantSession } from "@/lib/candidats/session";
import { hashPassword } from "@/lib/candidats/password";
import { MOT_DE_PASSE_MIN } from "@/lib/candidats/profil";
import { retourAutorise } from "@/lib/candidats/retour";
import { invitationValide } from "@/lib/candidats/invitation-lecture";

// Lien « Crée ton compte » (invitation.ts) : la personne choisit son mot de
// passe, son accès s'ouvre et elle est connectée tout de suite.
export async function creerCompteDepuisInvitation(
  token: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const invitation = await invitationValide(token);
  if (!invitation) return { error: "Ce lien n'est plus valide (expiré ou déjà utilisé)." };
  if (invitation.compteExistant) return { error: "Ton compte existe déjà : connecte-toi avec ton email et ton mot de passe." };

  const motDePasse = String(formData.get("password") ?? "");
  if (motDePasse.length < MOT_DE_PASSE_MIN) {
    return { error: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.` };
  }
  if (motDePasse !== String(formData.get("password_confirmation") ?? "")) {
    return { error: "Les deux mots de passe ne sont pas identiques." };
  }

  const supabase = createAdminClient();
  const { data: figurantId, error } = await supabase.rpc("activer_compte_invitation", {
    p_token: token,
    p_password_hash: await hashPassword(motDePasse),
  });
  if (error || !figurantId) return { error: "Ce lien n'est plus valide ou le compte a déjà été créé. Connecte-toi ou demande une nouvelle invitation." };

  await createFigurantSession(figurantId);
  redirect(retourAutorise(formData.get("retour")) ?? "/compte?bienvenue=1");
}
