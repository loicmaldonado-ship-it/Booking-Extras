"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Convention, ProjetType } from "./types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function buildProjetPayload(fd: FormData) {
  return {
    nom: str(fd, "nom") ?? "",
    type: str(fd, "type") as ProjetType | null,
    convention: str(fd, "convention") as Convention | null,
    realisateur: str(fd, "realisateur"),
    societe_production: str(fd, "societe_production"),
    diffuseur: str(fd, "diffuseur"),
    confidentiel: fd.get("confidentiel") === "on",
    nom_code: str(fd, "nom_code"),
    date_debut: str(fd, "date_debut"),
    date_fin: str(fd, "date_fin"),
    lieu: str(fd, "lieu"),
    contact_nom: str(fd, "contact_nom"),
    contact_telephone: str(fd, "contact_telephone"),
    contact_email: str(fd, "contact_email"),
    besoins_figuration: str(fd, "besoins_figuration"),
    synopsis: str(fd, "synopsis"),
    signature: str(fd, "signature"),
    gmail_smtp_user: str(fd, "gmail_smtp_user"),
    gmail_smtp_app_password: str(fd, "gmail_smtp_app_password"),
  };
}

function validateProjetPayload(payload: ReturnType<typeof buildProjetPayload>) {
  if (!payload.nom) {
    return "Le nom du projet est obligatoire.";
  }
  if (!!payload.gmail_smtp_user !== !!payload.gmail_smtp_app_password) {
    return "Renseigne l'adresse Gmail ET le mot de passe d'application, ou laisse les deux champs vides.";
  }
  return null;
}

export async function createProjet(_prevState: unknown, formData: FormData) {
  const payload = buildProjetPayload(formData);
  const validationError = validateProjetPayload(payload);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projets")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projets");
  redirect(`/projets/${data.id}`);
}

export async function updateProjet(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const payload = buildProjetPayload(formData);
  const validationError = validateProjetPayload(payload);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("projets").update(payload).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  redirect(`/projets/${id}`);
}

export async function deleteProjet(id: string) {
  const supabase = createAdminClient();
  await supabase.from("projets").delete().eq("id", id);
  revalidatePath("/projets");
  redirect("/projets");
}
