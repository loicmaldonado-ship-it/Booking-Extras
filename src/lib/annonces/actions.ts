"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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
    limite_candidatures: limiteRaw ? Number(limiteRaw) : null,
  };
}

export async function createAnnonce(_prevState: unknown, formData: FormData) {
  const payload = buildAnnoncePayload(formData);
  if (!payload.titre || !payload.projet_id) {
    return { error: "Le titre et le projet sont obligatoires." };
  }

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

  const supabase = createAdminClient();
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
  await supabase.from("annonces").delete().eq("id", id);
  revalidatePath("/annonces");
  redirect("/annonces");
}

export async function toggleAnnonceStatut(id: string, statut: AnnonceStatut) {
  const supabase = createAdminClient();
  await supabase.from("annonces").update({ statut }).eq("id", id);
  revalidatePath("/annonces");
  revalidatePath(`/annonces/${id}`);
}
