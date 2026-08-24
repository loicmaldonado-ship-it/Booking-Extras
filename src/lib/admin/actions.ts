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
