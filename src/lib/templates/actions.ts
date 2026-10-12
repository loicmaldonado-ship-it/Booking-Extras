"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createTemplate(_prevState: unknown, formData: FormData) {
  if (!(await getCurrentProfile())) return { error: "Non autorisé." };
  const nom = str(formData, "nom");
  const sujet = str(formData, "sujet");
  const corps = str(formData, "corps");

  if (!nom || !sujet || !corps) {
    return { error: "Nom, sujet et corps sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("message_templates").insert({ nom, sujet, corps });

  if (error) return { error: error.message };

  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
  return { success: true };
}

export async function updateTemplate(id: string, _prevState: unknown, formData: FormData) {
  if (!(await getCurrentProfile())) return { error: "Non autorisé." };
  const nom = str(formData, "nom");
  const sujet = str(formData, "sujet");
  const corps = str(formData, "corps");

  if (!nom || !sujet || !corps) {
    return { error: "Nom, sujet et corps sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("message_templates").update({ nom, sujet, corps }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
  return { success: true };
}

export async function deleteTemplate(id: string) {
  if (!(await getCurrentProfile())) return { error: "Non autorisé." };
  const supabase = createAdminClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/modeles");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
