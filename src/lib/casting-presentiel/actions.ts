"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import type { BookingStatut } from "@/lib/bookings/types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

async function checkEntryAccess(entryId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("casting_presentiel_entries").select("projet_id").eq("id", entryId).maybeSingle();
  if (!data) return null;
  return checkProjetAccess(data.projet_id);
}

async function checkJourneeAccess(journeeId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_presentiel_journees")
    .select("projet_id")
    .eq("id", journeeId)
    .maybeSingle();
  if (!data) return null;
  return checkProjetAccess(data.projet_id);
}

export async function createPresentielJournee(projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) throw new Error(accessError);

  const dates = Array.from(new Set(formData.getAll("date").map((d) => String(d).trim()).filter(Boolean)));
  if (dates.length === 0) return;

  const supabase = createAdminClient();
  await supabase
    .from("casting_presentiel_journees")
    .upsert(
      dates.map((date) => ({ projet_id: projetId, date })),
      { onConflict: "projet_id,date" }
    );

  revalidatePath("/casting/presentiel");
  if (dates.length === 1) {
    redirect(`/casting/presentiel/journee?projet_id=${projetId}&date=${dates[0]}`);
  }
  redirect("/casting/presentiel");
}

export async function deletePresentielJournee(journeeId: string) {
  const supabase = createAdminClient();
  const { data: journee } = await supabase
    .from("casting_presentiel_journees")
    .select("projet_id")
    .eq("id", journeeId)
    .maybeSingle();
  if (!journee) return { error: "Journée introuvable." };
  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) return { error: accessError };

  const { count } = await supabase
    .from("casting_presentiel_entries")
    .select("id", { count: "exact", head: true })
    .eq("journee_id", journeeId);
  if (count && count > 0) return { error: "Cette journée contient encore des profils." };

  await supabase.from("casting_presentiel_journees").delete().eq("id", journeeId);
  revalidatePath("/casting/presentiel");
  return { ok: true };
}

export async function updatePresentielLieu(journeeId: string, lieu: string | null) {
  const accessError = await checkJourneeAccess(journeeId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase.from("casting_presentiel_journees").update({ lieu }).eq("id", journeeId);
  if (error) return { error: error.message };

  revalidatePath("/casting/presentiel/journee");
  return { success: true as const };
}

export async function addFigurantToPresentielJournee(
  journeeId: string,
  figurantId: string,
  projetId: string,
  roleId: string | null
): Promise<{ error?: string; success?: true }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("casting_presentiel_entries")
    .select("id")
    .eq("journee_id", journeeId)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (existing) return { error: "Ce profil est déjà sur cette journée." };

  const { error } = await supabase.from("casting_presentiel_entries").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    journee_id: journeeId,
    role_id: roleId,
    statut: "proposé",
  });
  if (error) return { error: error.message };

  revalidatePath("/casting/presentiel/journee");
  return { success: true };
}

export async function updatePresentielEntryRole(entryId: string, roleId: string | null) {
  const accessError = await checkEntryAccess(entryId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("casting_presentiel_entries").update({ role_id: roleId }).eq("id", entryId);
  revalidatePath("/casting/presentiel/journee");
  return { success: true as const };
}

export async function updatePresentielEntryNotes(entryId: string, notes: string) {
  const accessError = await checkEntryAccess(entryId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("casting_presentiel_entries").update({ notes: notes.trim() || null }).eq("id", entryId);
  revalidatePath("/casting/presentiel/journee");
  return { success: true as const };
}

// Envoi rapide depuis le panneau d'un rôle (page /casting) : ajoute une
// sélection de profils directement à une journée de casting présentiel, et
// les place dans un créneau si un a été choisi — en un seul aller-retour,
// pas de recherche nom par nom depuis la page de la journée.
export async function sendFigurantsToPresentiel(
  figurantIds: string[],
  projetId: string,
  journeeId: string,
  creneauId: string | null,
  roleId: string | null
): Promise<{ error?: string; ok?: number; deja?: number }> {
  if (figurantIds.length === 0) return { error: "Aucun profil sélectionné." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  let ok = 0;
  let deja = 0;
  for (const figurantId of figurantIds) {
    const { data: existing } = await supabase
      .from("casting_presentiel_entries")
      .select("id")
      .eq("journee_id", journeeId)
      .eq("figurant_id", figurantId)
      .maybeSingle();
    if (existing) {
      deja += 1;
      continue;
    }
    const { error } = await supabase.from("casting_presentiel_entries").insert({
      figurant_id: figurantId,
      projet_id: projetId,
      journee_id: journeeId,
      role_id: roleId,
      creneau_id: creneauId,
      statut: "proposé",
    });
    if (!error) ok += 1;
  }

  revalidatePath("/casting/presentiel/journee");
  revalidatePath("/casting/presentiel");
  return { ok, deja };
}

export async function removePresentielEntry(entryId: string) {
  const accessError = await checkEntryAccess(entryId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("casting_presentiel_entries").delete().eq("id", entryId);
  revalidatePath("/casting/presentiel/journee");
}

export async function updatePresentielStatut(entryId: string, statut: BookingStatut) {
  const accessError = await checkEntryAccess(entryId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("casting_presentiel_entries").update({ statut }).eq("id", entryId);
  revalidatePath("/casting/presentiel/journee");
}

// Changement de statut groupé — depuis une sélection multiple sur la
// journée, plutôt que profil par profil.
export async function updatePresentielStatutBulk(
  entryIds: string[],
  statut: BookingStatut
): Promise<{ error?: string; ok?: number }> {
  if (entryIds.length === 0) return { error: "Aucun profil sélectionné." };

  const supabase = createAdminClient();
  const { data: entries } = await supabase.from("casting_presentiel_entries").select("id, projet_id").in("id", entryIds);
  const projetIds = Array.from(new Set((entries ?? []).map((e) => e.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  const { error } = await supabase.from("casting_presentiel_entries").update({ statut }).in("id", entryIds);
  if (error) return { error: error.message };

  revalidatePath("/casting/presentiel/journee");
  return { ok: entryIds.length };
}

export async function addPresentielCreneau(journeeId: string, _prevState: unknown, formData: FormData) {
  const accessError = await checkJourneeAccess(journeeId);
  if (accessError) return { error: accessError };

  const heureDebut = str(formData, "heure_debut");
  const heureFin = str(formData, "heure_fin");
  const capacite = Number(str(formData, "capacite") ?? "1");

  if (!heureDebut || !heureFin) return { error: "Heure de début et de fin obligatoires." };
  if (!Number.isFinite(capacite) || capacite < 1) return { error: "Capacité invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("casting_presentiel_creneaux").insert({
    journee_id: journeeId,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    capacite,
  });

  if (error) return { error: error.message };
  revalidatePath("/casting/presentiel/journee");
  return { success: true };
}

export async function generatePresentielCreneaux(journeeId: string, _prevState: unknown, formData: FormData) {
  const accessError = await checkJourneeAccess(journeeId);
  if (accessError) return { error: accessError };

  const heureDebut = str(formData, "heure_debut");
  const heureFin = str(formData, "heure_fin");
  const dureeMinutes = Number(str(formData, "duree_minutes") ?? "60");
  const capacite = Number(str(formData, "capacite") ?? "3");

  if (!heureDebut || !heureFin) return { error: "Heure de début et de fin de journée obligatoires." };
  if (!Number.isFinite(dureeMinutes) || dureeMinutes < 5) return { error: "Durée par créneau invalide." };
  if (!Number.isFinite(capacite) || capacite < 1) return { error: "Capacité invalide." };

  const [startH, startM] = heureDebut.split(":").map(Number);
  const [endH, endM] = heureFin.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("casting_presentiel_creneaux")
    .select("heure_debut")
    .eq("journee_id", journeeId);
  const existingSet = new Set((existing ?? []).map((c) => c.heure_debut.slice(0, 5)));

  function toHHMM(totalMinutes: number) {
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  const toInsert: { journee_id: string; heure_debut: string; heure_fin: string; capacite: number }[] = [];
  for (let t = startTotal; t + dureeMinutes <= endTotal; t += dureeMinutes) {
    const debut = toHHMM(t);
    if (existingSet.has(debut)) continue;
    toInsert.push({
      journee_id: journeeId,
      heure_debut: debut,
      heure_fin: toHHMM(t + dureeMinutes),
      capacite,
    });
  }

  if (toInsert.length === 0) {
    return { error: "Aucun nouveau créneau à créer (déjà existants ou plage horaire vide)." };
  }

  const { error } = await supabase.from("casting_presentiel_creneaux").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/casting/presentiel/journee");
  return { success: true, count: toInsert.length };
}

export async function removePresentielCreneau(creneauId: string) {
  const supabase = createAdminClient();
  const { data: creneau } = await supabase
    .from("casting_presentiel_creneaux")
    .select("journee_id")
    .eq("id", creneauId)
    .maybeSingle();
  if (creneau) {
    const accessError = await checkJourneeAccess(creneau.journee_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("casting_presentiel_entries").update({ creneau_id: null }).eq("creneau_id", creneauId);
  await supabase.from("casting_presentiel_creneaux").delete().eq("id", creneauId);
  revalidatePath("/casting/presentiel/journee");
}

export async function assignPresentielEntryToCreneau(entryId: string, creneauId: string | null) {
  const accessError = await checkEntryAccess(entryId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("casting_presentiel_entries").update({ creneau_id: creneauId }).eq("id", entryId);
  revalidatePath("/casting/presentiel/journee");
}
