"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

// Onglets de casting : regroupements de rôles créés par la cheffe. Toutes les
// actions vérifient l'accès au projet concerné (jamais l'id envoyé par le
// navigateur seul).

function nettoyerNom(nom: string): string {
  return nom.replace(/\s+/g, " ").trim().slice(0, 60);
}

// « Épisode 1 » et « épisode 1 » sont le même onglet pour la cheffe : la base ne
// distingue que la casse exacte, donc on vérifie aussi sans tenir compte des
// majuscules.
async function nomDejaPris(projetId: string, nom: string, sauf?: string): Promise<boolean> {
  const { data } = await createAdminClient().from("casting_onglets").select("id, nom").eq("projet_id", projetId);
  const cle = nom.toLowerCase();
  return (data ?? []).some((o) => o.id !== sauf && o.nom.toLowerCase() === cle);
}

export async function creerOnglet(projetId: string, nomBrut: string): Promise<{ id?: string; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const nom = nettoyerNom(nomBrut);
  if (!nom) return { error: "Donne un nom à l'onglet." };
  if (await nomDejaPris(projetId, nom)) return { error: "Un onglet porte déjà ce nom." };

  const supabase = createAdminClient();
  const { data: dernier } = await supabase
    .from("casting_onglets")
    .select("ordre")
    .eq("projet_id", projetId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("casting_onglets")
    .insert({ projet_id: projetId, nom, ordre: (dernier?.ordre ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "Un onglet porte déjà ce nom." : error.message };
  revalidatePath("/casting");
  return { id: data.id };
}

async function ongletAvecAcces(ongletId: string): Promise<{ projetId?: string; error?: string }> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("casting_onglets").select("projet_id").eq("id", ongletId).maybeSingle();
  if (!data) return { error: "Onglet introuvable." };
  const accessError = await checkProjetAccess(data.projet_id);
  if (accessError) return { error: accessError };
  return { projetId: data.projet_id };
}

export async function renommerOnglet(ongletId: string, nomBrut: string): Promise<{ error?: string }> {
  const acces = await ongletAvecAcces(ongletId);
  if (acces.error) return { error: acces.error };
  const nom = nettoyerNom(nomBrut);
  if (!nom) return { error: "Donne un nom à l'onglet." };
  if (acces.projetId && (await nomDejaPris(acces.projetId, nom, ongletId))) return { error: "Un onglet porte déjà ce nom." };
  const { error } = await createAdminClient().from("casting_onglets").update({ nom }).eq("id", ongletId);
  if (error) return { error: error.code === "23505" ? "Un onglet porte déjà ce nom." : error.message };
  revalidatePath("/casting");
  return {};
}

// Les rôles de l'onglet ne sont pas supprimés : la base les remet « sans onglet ».
export async function supprimerOnglet(ongletId: string): Promise<{ error?: string }> {
  const acces = await ongletAvecAcces(ongletId);
  if (acces.error) return { error: acces.error };
  const { error } = await createAdminClient().from("casting_onglets").delete().eq("id", ongletId);
  if (error) return { error: error.message };
  revalidatePath("/casting");
  return {};
}

// Range des rôles dans un onglet (null = les sortir de tout onglet). Les rôles
// et l'onglet doivent appartenir au même projet.
export async function rangerRoles(
  projetId: string,
  roleIds: string[],
  ongletId: string | null
): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (roleIds.length === 0) return {};

  const supabase = createAdminClient();
  if (ongletId) {
    const { data: onglet } = await supabase
      .from("casting_onglets")
      .select("id")
      .eq("id", ongletId)
      .eq("projet_id", projetId)
      .maybeSingle();
    if (!onglet) return { error: "Onglet introuvable sur ce projet." };
  }
  for (let i = 0; i < roleIds.length; i += 100) {
    const { error } = await supabase
      .from("casting_roles")
      .update({ onglet_id: ongletId })
      .eq("projet_id", projetId)
      .in("id", roleIds.slice(i, i + 100));
    if (error) return { error: error.message };
  }
  revalidatePath("/casting");
  return {};
}
