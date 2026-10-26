"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFigurantSession } from "@/lib/candidats/session";
import { definirMotDePasse } from "@/lib/candidats/mot-de-passe";
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
  const { error } = await definirMotDePasse(invitation.figurantId, motDePasse);
  if (error) return { error: "Création du compte impossible, réessaie." };
  await Promise.all([
    supabase.from("figurants").update({ acces_compte: true }).eq("id", invitation.figurantId),
    supabase.from("figurant_auth_tokens").update({ used_at: new Date().toISOString() }).eq("id", invitation.id),
  ]);

  await createFigurantSession(invitation.figurantId);
  redirect(retourAutorise(formData.get("retour")) ?? "/compte?bienvenue=1");
}
