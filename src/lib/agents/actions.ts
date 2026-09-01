"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import type { Agent } from "./types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

async function ownerAccessError(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) return "Réservé au compte propriétaire.";
  return null;
}

// Autocomplete depuis une fiche/carte casting — ouvert à toute l'équipe
// (mêmes infos déjà visibles là où l'agent est saisi), contrairement à la
// gestion complète de la base (liste, édition, suppression) réservée à
// l'admin. Ne renvoie rien pour une requête trop courte, pour ne jamais
// exposer toute la base par une recherche vide.
export async function searchAgents(query: string): Promise<Agent[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .ilike("nom", `%${trimmed}%`)
    .order("nom")
    .limit(8)
    .returns<Agent[]>();
  return data ?? [];
}

// Rattache/complète un agent dans la base commune à partir d'une saisie
// staff (fiche figurant, carte casting) — jamais appelé depuis le
// formulaire public de candidature. Dédoublonne par email si fourni, sinon
// par nom (insensible à la casse), pour éviter un doublon "Jean Dupont" /
// "jean dupont" créé séparément à chaque fiche saisie à la main.
export async function upsertAgent(agent: {
  nom: string;
  agence?: string | null;
  email?: string | null;
  telephone?: string | null;
}): Promise<void> {
  if (!agent.nom) return;
  const supabase = createAdminClient();

  let existing: { id: string } | null = null;
  if (agent.email) {
    const { data } = await supabase.from("agents").select("id").ilike("email", agent.email).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await supabase.from("agents").select("id").ilike("nom", agent.nom).maybeSingle();
    existing = data;
  }

  const payload = {
    nom: agent.nom,
    agence: agent.agence ?? null,
    email: agent.email ?? null,
    telephone: agent.telephone ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("agents").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("agents").insert(payload);
  }
}

export async function listAgents(): Promise<Agent[]> {
  const accessError = await ownerAccessError();
  if (accessError) return [];

  const supabase = createAdminClient();
  const { data } = await supabase.from("agents").select("*").order("nom").returns<Agent[]>();
  return data ?? [];
}

export async function createAgent(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const accessError = await ownerAccessError();
  if (accessError) return { error: accessError };

  const nom = str(formData, "nom");
  if (!nom) return { error: "Le nom est obligatoire." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("agents").insert({
    nom,
    agence: str(formData, "agence"),
    email: str(formData, "email"),
    telephone: str(formData, "telephone"),
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function updateAgent(id: string, formData: FormData): Promise<{ error?: string; success?: true }> {
  const accessError = await ownerAccessError();
  if (accessError) return { error: accessError };

  const nom = str(formData, "nom");
  if (!nom) return { error: "Le nom est obligatoire." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("agents")
    .update({
      nom,
      agence: str(formData, "agence"),
      email: str(formData, "email"),
      telephone: str(formData, "telephone"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/agents");
  return { success: true };
}

export async function deleteAgent(id: string) {
  const accessError = await ownerAccessError();
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("agents").delete().eq("id", id);
  revalidatePath("/admin/agents");
  return { success: true as const };
}
