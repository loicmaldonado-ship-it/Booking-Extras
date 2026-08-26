"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

// Fiche membre — obligatoire pour les cheffes (photo, email, nom, prénom,
// téléphone) avant de pouvoir utiliser le reste de l'appli, voir
// AppShell/getCurrentProfile (profileComplete) et /mon-compte.
export async function updateMyProfile(_prevState: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté." };

  const prenom = str(formData, "prenom");
  const nom = str(formData, "nom");
  const telephone = str(formData, "telephone");

  if (!prenom || !nom || !telephone) {
    return { error: "Prénom, nom et téléphone sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ prenom, nom, telephone }).eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true as const };
}
