"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef } from "@/lib/auth/session";

async function findOrInviteProfile(email: string, projetNom: string) {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/invite`,
    data: { projet_nom: projetNom },
  });
  if (!inviteError && invited.user) {
    return { id: invited.user.id, error: null as string | null };
  }

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { id: existing.id, error: null as string | null };
  }

  return { id: null, error: inviteError?.message ?? "Impossible d'inviter cet email." };
}

export async function inviteAssistant(_prevState: unknown, formData: FormData) {
  await requireChef();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const projetId = String(formData.get("projet_id") ?? "");

  if (!email || !projetId) {
    return { error: "Email et projet sont obligatoires." };
  }

  const admin = createAdminClient();
  const { data: projet } = await admin.from("projets").select("nom").eq("id", projetId).single();

  const { id: profileId, error } = await findOrInviteProfile(email, projet?.nom ?? "");
  if (!profileId) {
    return { error };
  }

  const { error: membreError } = await admin
    .from("projet_membres")
    .upsert({ projet_id: projetId, profile_id: profileId }, { onConflict: "projet_id,profile_id" });

  if (membreError) {
    return { error: membreError.message };
  }

  revalidatePath("/equipe");
  return { success: true };
}

export async function revokeAccess(projetMembreId: string) {
  await requireChef();
  const admin = createAdminClient();
  await admin.from("projet_membres").delete().eq("id", projetMembreId);
  revalidatePath("/equipe");
}
