import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnnonceDate } from "./dates";
import type { AnnonceQuestion } from "./questions";

export async function getAnnonceDates(annonceId: string): Promise<AnnonceDate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("annonce_dates")
    .select("id, annonce_id, date")
    .eq("annonce_id", annonceId)
    .order("date");
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
