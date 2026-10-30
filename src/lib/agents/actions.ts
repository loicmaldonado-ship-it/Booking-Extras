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

// Names and emails are literal values, never SQL LIKE patterns.
function literalLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
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
  if (!(await getCurrentProfile())) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .ilike("nom", `%${literalLike(trimmed)}%`)
    .order("nom")
    .limit(8)
    .returns<Agent[]>();
  return data ?? [];
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
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) return { error: "L'agent n'a pas pu être supprimé." };
  revalidatePath("/admin/agents");
  return { success: true as const };
}
