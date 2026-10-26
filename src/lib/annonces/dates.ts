"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAnnonceAccess } from "./access";

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
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) return { error: accessError };

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
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) throw new Error(accessError);

  const supabase = createAdminClient();
  const { error } = await supabase.from("annonce_dates").delete().eq("id", id).eq("annonce_id", annonceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/annonces/${annonceId}`);
}

const MAX_JOURS_PERIODE = 120;

// Ajoute un jour de tournage par date de la période (du … au …), et passe
// l'annonce en mode « indispos sur calendrier » : les candidat·es cochent
// seulement les jours où ils ne sont pas dispo.
export async function ajouterPeriodeAnnonce(
  annonceId: string,
  debut: string,
  fin: string
): Promise<{ error?: string; ajoutes?: number }> {
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) return { error: accessError };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) return { error: "Dates invalides." };
  if (fin < debut) return { error: "La fin de la période doit être après le début." };

  const jours: string[] = [];
  const d = new Date(`${debut}T12:00:00Z`);
  const f = new Date(`${fin}T12:00:00Z`);
  while (d <= f) {
    jours.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
    if (jours.length > MAX_JOURS_PERIODE) return { error: `Période trop longue (${MAX_JOURS_PERIODE} jours maximum).` };
  }

  const supabase = createAdminClient();
  const { data: existantes } = await supabase.from("annonce_dates").select("date").eq("annonce_id", annonceId);
  const deja = new Set((existantes ?? []).map((x) => x.date));
  const nouvelles = jours.filter((j) => !deja.has(j));
  if (nouvelles.length > 0) {
    const { error } = await supabase
      .from("annonce_dates")
      .insert(nouvelles.map((date) => ({ annonce_id: annonceId, date })));
    if (error) return { error: error.message };
  }
  await supabase.from("annonces").update({ dispos_par_calendrier: true }).eq("id", annonceId);

  revalidatePath(`/annonces/${annonceId}`);
  return { ajoutes: nouvelles.length };
}

export async function setDisposParCalendrier(annonceId: string, actif: boolean): Promise<{ error?: string }> {
  const accessError = await checkAnnonceAccess(annonceId);
  if (accessError) return { error: accessError };
  const { error } = await createAdminClient().from("annonces").update({ dispos_par_calendrier: actif }).eq("id", annonceId);
  if (error) return { error: error.message };
  revalidatePath(`/annonces/${annonceId}`);
  return {};
}
