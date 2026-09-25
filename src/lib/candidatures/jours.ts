"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import type { Cachet } from "./types";

// Prévoit (ou retire) une candidature sur un jour de tournage de son
// annonce. Rangement pur : aucun booking n'est créé ici, c'est
// envoyerJourAuTournage qui s'en charge, jour par jour.
export async function setCandidatureJour(
  candidatureId: string,
  annonceDateId: string,
  prevu: boolean
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const [{ data: candidature }, { data: annonceDate }] = await Promise.all([
    supabase.from("candidatures").select("annonce_id, annonces(projet_id)").eq("id", candidatureId).maybeSingle<{
      annonce_id: string;
      annonces: { projet_id: string } | null;
    }>(),
    supabase.from("annonce_dates").select("annonce_id").eq("id", annonceDateId).maybeSingle(),
  ]);
  if (!candidature?.annonces || !annonceDate) return { error: "Candidature ou date introuvable." };
  if (annonceDate.annonce_id !== candidature.annonce_id) return { error: "Cette date n'appartient pas à cette annonce." };
  const accessError = await checkProjetAccess(candidature.annonces.projet_id);
  if (accessError) return { error: accessError };

  const { error } = prevu
    ? await supabase
        .from("candidature_jours")
        .upsert({ candidature_id: candidatureId, annonce_date_id: annonceDateId }, { ignoreDuplicates: true })
    : await supabase
        .from("candidature_jours")
        .delete()
        .eq("candidature_id", candidatureId)
        .eq("annonce_date_id", annonceDateId);
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return {};
}

// Crée, dans la journée de tournage correspondante (créée si besoin), un
// booking pour chaque personne prévue ce jour-là, avec le statut de départ
// habituel (PER, comme createBookingsFromDropBulk) — rien n'est envoyé aux
// figurant·es. Ceux déjà bookés ce jour sur ce projet sont
// ignorés. Une candidature ne peut être rattachée qu'à un seul booking
// (contrainte unique) : sur plusieurs jours, seul le premier booking la
// porte.
export async function envoyerJourAuTournage(
  annonceDateId: string,
  fonction: string,
  cachet: Cachet | ""
): Promise<{ ok: number; deja: number; error?: string }> {
  const supabase = createAdminClient();
  const { data: annonceDate } = await supabase
    .from("annonce_dates")
    .select("date, annonces(projet_id)")
    .eq("id", annonceDateId)
    .maybeSingle<{ date: string; annonces: { projet_id: string } | null }>();
  if (!annonceDate?.annonces) return { ok: 0, deja: 0, error: "Date introuvable." };
  const projetId = annonceDate.annonces.projet_id;
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ok: 0, deja: 0, error: accessError };

  const { data: prevus } = await supabase
    .from("candidature_jours")
    .select("candidature_id, candidatures(figurant_id)")
    .eq("annonce_date_id", annonceDateId)
    .returns<{ candidature_id: string; candidatures: { figurant_id: string } | null }[]>();
  const rows = (prevus ?? []).filter((p) => p.candidatures);
  if (rows.length === 0) return { ok: 0, deja: 0 };

  const figurantIds = rows.map((r) => r.candidatures!.figurant_id);
  const candidatureIds = rows.map((r) => r.candidature_id);
  const [{ data: existants }, { data: dejaRattachees }] = await Promise.all([
    supabase
      .from("bookings")
      .select("figurant_id")
      .eq("projet_id", projetId)
      .eq("date", annonceDate.date)
      .in("figurant_id", figurantIds),
    supabase.from("bookings").select("candidature_id").in("candidature_id", candidatureIds),
  ]);
  const dejaBookes = new Set((existants ?? []).map((b) => b.figurant_id));
  const rattachees = new Set((dejaRattachees ?? []).map((b) => b.candidature_id));

  const payload = rows
    .filter((r) => !dejaBookes.has(r.candidatures!.figurant_id))
    .map((r) => ({
      figurant_id: r.candidatures!.figurant_id,
      projet_id: projetId,
      date: annonceDate.date,
      candidature_id: rattachees.has(r.candidature_id) ? null : r.candidature_id,
      fonction: fonction.trim() || null,
      cachet: cachet || null,
    }));
  const deja = rows.length - payload.length;
  if (payload.length === 0) return { ok: 0, deja };

  await supabase.from("journees").upsert({ projet_id: projetId, date: annonceDate.date }, { onConflict: "projet_id,date" });
  const { error } = await supabase.from("bookings").insert(payload);
  if (error) return { ok: 0, deja, error: error.message };
  await supabase.from("figurants").update({ confirme: true }).in("id", payload.map((p) => p.figurant_id));

  revalidatePath("/candidatures");
  revalidatePath("/bookings/planning");
  revalidatePath("/figurants");
  return { ok: payload.length, deja };
}
