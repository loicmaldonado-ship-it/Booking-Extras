"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, checkProjetAccess, idsOrNone } from "@/lib/auth/session";
import { findOrInviteProfile } from "@/lib/auth/invite";
import { aAccesComplet } from "@/lib/auth/owner";
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
  const { data: projet, error: projetError } = await admin.from("projets").select("nom").eq("id", projetId).single();
  if (projetError || !projet) return { error: "Impossible de vérifier ce projet. Réessaie." };

  const { id: profileId, invited, error } = await findOrInviteProfile(email, { projet_nom: projet.nom ?? "" });
  if (!profileId) {
    return { error };
  }

  const { error: membreError } = await admin
    .from("projet_membres")
    .upsert({ projet_id: projetId, profile_id: profileId }, { onConflict: "projet_id,profile_id" });

  if (membreError) {
    return { error: invited
      ? "L’invitation par email a été envoyée, mais l’accès au projet n’a pas pu être accordé. Réessaie de rattacher cette personne au projet."
      : "Impossible d’accorder l’accès au projet. Réessaie." };
  }

  revalidatePath("/equipe");
  return { success: true, invited };
}

export async function revokeAccess(projetMembreId: string) {
  const admin = createAdminClient();
  const { data: membre, error: membreError } = await admin
    .from("projet_membres")
    .select("projet_id")
    .eq("id", projetMembreId)
    .maybeSingle();
  if (membreError || !membre) return { error: "Impossible de vérifier cet accès." };

  const accessError = await requireChefOnProjet(membre.projet_id);
  if (accessError) return { error: accessError };
  // Révoquer l'accès d'un compte : réservé aux comptes à accès complet.
  if (!aAccesComplet(await getCurrentProfile())) return { error: "Seuls les comptes à accès complet peuvent révoquer un accès." };

  const { data: removed, error } = await admin.from("projet_membres").delete().eq("id", projetMembreId).select("id").maybeSingle();
  if (error || !removed) return { error: "Impossible de révoquer cet accès. Réessaie." };
  revalidatePath("/equipe");
  return { success: true };
}

// Stockage global sur profiles (pas par projet_membres) : un·e assistant·e
// n'a qu'un seul jeu de sections autorisées, valable sur tous les projets où
// iel est invité·e. On vérifie juste que l'assistant·e visé·e est bien
// rattaché·e à l'un des projets de la cheffe qui fait la demande, pour
// empêcher de modifier les accès d'un·e assistant·e qu'on ne gère pas.
export async function updateAssistantSections(profileId: string, sections: SectionKey[] | null) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "chef") return { error: "Réservé au·à la chef·fe de casting." };

  const admin = createAdminClient();
  const accessibleProjetIds = await getAccessibleProjetIds(profile);
  const { data: membre, error: membreError } = await admin
    .from("projet_membres")
    .select("id")
    .eq("profile_id", profileId)
    .in("projet_id", idsOrNone(accessibleProjetIds ?? []))
    .limit(1)
    .maybeSingle();
  if (membreError) return { error: "Impossible de vérifier les projets de cet accès." };
  if (!membre) return { error: "Cet assistant·e n'est rattaché·e à aucun de vos projets." };

  const { data: updated, error } = await admin.from("profiles").update({ sections_autorisees: sections }).eq("id", profileId).select("id").maybeSingle();
  if (error || !updated) return { error: "Impossible d'enregistrer les sections. Réessaie." };
  revalidatePath("/equipe");
  return { success: true };
}
