"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { equipesModeles } from "./equipe";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createTemplate(_prevState: unknown, formData: FormData) {
  const nom = str(formData, "nom");
  const sujet = str(formData, "sujet");
  const corps = str(formData, "corps");

  if (!nom || !sujet || !corps) {
    return { error: "Nom, sujet et corps sont obligatoires." };
  }

  const { ecriture } = await equipesModeles(await getCurrentProfile());
  if (!ecriture) return { error: "Non autorisé." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("message_templates").insert({ nom, sujet, corps, equipe_id: ecriture });

  if (error) return { error: error.message };

  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
  return { success: true };
}

export async function updateTemplate(id: string, _prevState: unknown, formData: FormData) {
  const nom = str(formData, "nom");
  const sujet = str(formData, "sujet");
  const corps = str(formData, "corps");

  if (!nom || !sujet || !corps) {
    return { error: "Nom, sujet et corps sont obligatoires." };
  }

  const { lecture } = await equipesModeles(await getCurrentProfile());
  if (lecture.length === 0) return { error: "Non autorisé." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("message_templates")
    .update({ nom, sujet, corps })
    .eq("id", id)
    .in("equipe_id", lecture)
    .select("id");
  if (!error && (data ?? []).length === 0) return { error: "Modèle introuvable." };

  if (error) return { error: error.message };

  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
  return { success: true };
}

export async function deleteTemplate(id: string) {
  const { lecture } = await equipesModeles(await getCurrentProfile());
  if (lecture.length === 0) return;
  const supabase = createAdminClient();
  await supabase.from("message_templates").delete().eq("id", id).in("equipe_id", lecture);
  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
}
