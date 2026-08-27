"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { findOrInviteProfile } from "@/lib/auth/invite";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) throw new Error("Réservé au compte propriétaire.");
  return profile!;
}

// Crée un compte chef·fe indépendant (base Figurants commune, projets
// privés) — réservé au compte propriétaire, pour éviter qu'une chef·fe en
// invite une autre sans validation. Distinct d'inviteAssistant (par projet,
// ouvert à toute chef·fe) : voir src/lib/equipe/actions.ts.
export async function inviteChef(_prevState: unknown, formData: FormData) {
  await requireOwner();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email obligatoire." };

  const { id: profileId, error } = await findOrInviteProfile(email);
  if (!profileId) return { error };

  const admin = createAdminClient();
  const { error: updateError } = await admin.from("profiles").update({ role: "chef" }).eq("id", profileId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/admin");
  return { success: true };
}

// Bloque la connexion d'une cheffe sans rien supprimer (projets, historique
// intacts) — via le bannissement natif de Supabase Auth plutôt qu'un
// champ maison, pour ne pas réinventer une règle de sécurité.
export async function revokeChefAccess(chefId: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(chefId, { ban_duration: "876000h" });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true as const };
}

export async function restoreChefAccess(chefId: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(chefId, { ban_duration: "none" });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true as const };
}

// Appelle directement inviteUserByEmail plutôt que findOrInviteProfile :
// celle-ci retombe silencieusement sur le compte existant (via listUsers)
// dès que l'invitation initiale échoue, ce qui masquerait un renvoi qui n'a
// en réalité rien envoyé. Ici on veut l'erreur brute si l'email n'est
// effectivement pas reparti (ex. la personne s'est déjà connectée une
// fois — Supabase refuse alors de renvoyer une invitation).
export async function resendChefInvite(chefId: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { data: chef } = await admin.from("profiles").select("email").eq("id", chefId).single();
  if (!chef?.email) return { error: "Email introuvable pour ce compte." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await admin.auth.admin.inviteUserByEmail(chef.email, {
    redirectTo: `${siteUrl}/auth/invite`,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true as const };
}
