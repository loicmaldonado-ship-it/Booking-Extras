"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import type { AnnonceStatut } from "./types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function buildAnnoncePayload(fd: FormData) {
  const limiteRaw = str(fd, "limite_candidatures");
  return {
    projet_id: str(fd, "projet_id") ?? "",
    titre: str(fd, "titre") ?? "",
    date_recherchee: str(fd, "date_recherchee"),
    lieu: str(fd, "lieu"),
    statut: (str(fd, "statut") ?? "ouverte") as AnnonceStatut,
    description: str(fd, "description"),
    ouverte_mineurs: fd.get("ouverte_mineurs") === "on",
    bande_demo_obligatoire: fd.get("bande_demo_obligatoire") === "on",
    limite_candidatures: limiteRaw ? Number(limiteRaw) : null,
    types_cachet: fd.getAll("types_cachet").map(String),
  };
}

export async function createAnnonce(_prevState: unknown, formData: FormData) {
  const payload = buildAnnoncePayload(formData);
  if (!payload.titre || !payload.projet_id) {
    return { error: "Le titre et le projet sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("annonces")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/annonces");
  redirect(`/annonces/${data.id}`);
}

export async function updateAnnonce(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const payload = buildAnnoncePayload(formData);
  if (!payload.titre || !payload.projet_id) {
    return { error: "Le titre et le projet sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("annonces").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const existingAccessError = await checkProjetAccess(existing.projet_id);
    if (existingAccessError) return { error: existingAccessError };
  }
  const { error } = await supabase.from("annonces").update(payload).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/annonces");
  revalidatePath(`/annonces/${id}`);
  redirect(`/annonces/${id}`);
}

export async function deleteAnnonce(id: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("annonces").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("annonces").delete().eq("id", id);
  revalidatePath("/annonces");
  redirect("/annonces");
}

export async function toggleAnnonceStatut(id: string, statut: AnnonceStatut) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("annonces").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("annonces").update({ statut }).eq("id", id);
  revalidatePath("/annonces");
  revalidatePath(`/annonces/${id}`);
}
