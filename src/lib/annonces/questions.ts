"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAnnonceAccess } from "./access";

export type QuestionTemplate = { id: string; label: string };
export type AnnonceQuestion = { id: string; annonce_id: string; label: string; ordre: number };

// Équipe de la cheffe propriétaire du projet de l'annonce (même clé que les
// modèles de messages et les fiches comédien·nes) : les questions
// enregistrées ne sont proposées qu'à cette équipe.
async function equipeDeLAnnonce(annonceId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("annonces")
    .select("projets(profiles!projets_owner_id_fkey(id, comedien_pool_id))")
    .eq("id", annonceId)
    .maybeSingle<{ projets: { profiles: { id: string; comedien_pool_id: string | null } | null } | null }>();
  const owner = data?.projets?.profiles;
  return owner ? (owner.comedien_pool_id ?? owner.id) : null;
}

export async function getQuestionTemplates(annonceId: string): Promise<QuestionTemplate[]> {
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) return [];
  const equipeId = await equipeDeLAnnonce(annonceId);
  if (!equipeId) return [];
  const supabase = createAdminClient();
  // Celles de l'équipe, puis les questions prêtes à l'emploi (communes).
  const { data } = await supabase
    .from("question_templates")
    .select("id, label, equipe_id")
    .or(`equipe_id.eq.${equipeId},equipe_id.is.null`)
    .order("label");
  const vues = new Set<string>();
  return [...(data ?? []).filter((q) => q.equipe_id), ...(data ?? []).filter((q) => !q.equipe_id)]
    .filter((q) => !vues.has(q.label) && !!vues.add(q.label))
    .map((q) => ({ id: q.id, label: q.label }));
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
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) return { error: accessError };

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

  const equipeId = await equipeDeLAnnonce(annonceId);
  if (equipeId) {
    await supabase
      .from("question_templates")
      .upsert({ label, equipe_id: equipeId }, { onConflict: "equipe_id,label", ignoreDuplicates: true });
  }

  revalidatePath(`/annonces/${annonceId}`);
  return { success: true as const };
}

export async function removeAnnonceQuestion(id: string, annonceId: string) {
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) throw new Error(accessError);

  const supabase = createAdminClient();
  const { error } = await supabase.from("annonce_questions").delete().eq("id", id).eq("annonce_id", annonceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/annonces/${annonceId}`);
}
