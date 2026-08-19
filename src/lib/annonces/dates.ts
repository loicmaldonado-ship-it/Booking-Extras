"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type AnnonceDate = { id: string; annonce_id: string; date: string };

export async function getAnnonceDates(annonceId: string): Promise<AnnonceDate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("annonce_dates")
    .select("id, annonce_id, date")
    .eq("annonce_id", annonceId)
    .order("date");
  return data ?? [];
}

export async function addAnnonceDate(annonceId: string, _prevState: unknown, formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  if (!date) return { error: "Date requise." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("annonce_dates")
    .upsert({ annonce_id: annonceId, date }, { onConflict: "annonce_id,date" });
  if (error) return { error: error.message };

  revalidatePath(`/annonces/${annonceId}`);
  return { success: true as const };
}

export async function removeAnnonceDate(id: string, annonceId: string) {
  const supabase = createAdminClient();
  await supabase.from("annonce_dates").delete().eq("id", id);
  revalidatePath(`/annonces/${annonceId}`);
}
