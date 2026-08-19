"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuestionTemplate = { id: string; label: string };
export type AnnonceQuestion = { id: string; annonce_id: string; label: string; ordre: number };

export async function getQuestionTemplates(): Promise<QuestionTemplate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("question_templates").select("id, label").order("label");
  return data ?? [];
}

export async function getAnnonceQuestions(annonceId: string): Promise<AnnonceQuestion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("annonce_questions")
    .select("id, annonce_id, label, ordre")
    .eq("annonce_id", annonceId)
    .order("ordre");
  return data ?? [];
}

export async function addAnnonceQuestion(annonceId: string, _prevState: unknown, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Question requise." };

  const supabase = createAdminClient();

  const { count } = await supabase
    .from("annonce_questions")
    .select("id", { count: "exact", head: true })
    .eq("annonce_id", annonceId);

  const { error } = await supabase.from("annonce_questions").insert({
    annonce_id: annonceId,
    label,
    ordre: count ?? 0,
  });
  if (error) return { error: error.message };

  await supabase.from("question_templates").upsert({ label }, { onConflict: "label" });

  revalidatePath(`/annonces/${annonceId}`);
  return { success: true as const };
}

export async function removeAnnonceQuestion(id: string, annonceId: string) {
  const supabase = createAdminClient();
  await supabase.from("annonce_questions").delete().eq("id", id);
  revalidatePath(`/annonces/${annonceId}`);
}
