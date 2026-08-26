"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, checkProjetAccess, idsOrNone } from "@/lib/auth/session";
import { findOrInviteProfile } from "@/lib/auth/invite";
import type { SectionKey } from "@/lib/auth/sections";

// Réservé au·à la chef·fe propriétaire du projet ciblé (ou au compte
// propriétaire) — pas à n'importe quelle chef·fe, sans quoi une chef·fe
// pourrait s'inviter elle-même (ou inviter qui elle veut) sur le projet
// d'une autre chef·fe.
async function requireChefOnProjet(projetId: string): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "chef") return "Réservé au·à la chef·fe de casting.";
  return checkProjetAccess(projetId);
}

export async function inviteAssistant(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const projetId = String(formData.get("projet_id") ?? "");

  if (!email || !projetId) {
    return { error: "Email et projet sont obligatoires." };
  }

  const accessError = await requireChefOnProjet(projetId);
  if (accessError) return { error: accessError };

  const admin = createAdminClient();
  const { data: projet } = await admin.from("projets").select("nom").eq("id", projetId).single();

  const { id: profileId, error } = await findOrInviteProfile(email, { projet_nom: projet?.nom ?? "" });
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
  const admin = createAdminClient();
  const { data: membre } = await admin
    .from("projet_membres")
    .select("projet_id")
    .eq("id", projetMembreId)
    .maybeSingle();
  if (!membre) return;

  const accessError = await requireChefOnProjet(membre.projet_id);
  if (accessError) throw new Error(accessError);

  await admin.from("projet_membres").delete().eq("id", projetMembreId);
  revalidatePath("/equipe");
}

// Stockage global sur profiles (pas par projet_membres) : un·e assistant·e
// n'a qu'un seul jeu de sections autorisées, valable sur tous les projets où
// iel est invité·e. On vérifie juste que l'assistant·e visé·e est bien
// rattaché·e à l'un des projets de la cheffe qui fait la demande, pour
// empêcher de modifier les accès d'un·e assistant·e qu'on ne gère pas.
export async function updateAssistantSections(profileId: string, sections: SectionKey[] | null) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "chef") throw new Error("Réservé au·à la chef·fe de casting.");

  const admin = createAdminClient();
  const accessibleProjetIds = await getAccessibleProjetIds(profile);
  const { data: membre } = await admin
    .from("projet_membres")
    .select("id")
    .eq("profile_id", profileId)
    .in("projet_id", idsOrNone(accessibleProjetIds ?? []))
    .limit(1)
    .maybeSingle();
  if (!membre) throw new Error("Cet assistant·e n'est rattaché·e à aucun de vos projets.");

  await admin.from("profiles").update({ sections_autorisees: sections }).eq("id", profileId);
  revalidatePath("/equipe");
}
