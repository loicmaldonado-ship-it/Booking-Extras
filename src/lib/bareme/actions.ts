"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef, checkProjetAccess } from "@/lib/auth/session";
import type { Convention } from "@/lib/projets/types";
import type { Cachet } from "@/lib/candidatures/types";
import type { MajorationValeurType } from "./types";
import { equipesModeles } from "@/lib/templates/equipe";
import { baremePourEquipes, clesEquipeProjets, ligneEquipe, preparerBaremeEquipe } from "./equipe";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Barème par équipe (30/10/2026) : une cheffe ne modifie que le barème de SON équipe (clé = celle des modèles de
// messages). La première modification copie la grille ACFDA de référence pour l'équipe ; la référence elle-même
// n'est jamais modifiée par l'application.
async function equipeEcriture(): Promise<string> {
  const profile = await requireChef();
  const { ecriture } = await equipesModeles(profile);
  if (!ecriture) throw new Error("Réservé au·à la chef·fe.");
  return ecriture;
}

export async function createBaremeCachet(_prevState: unknown, formData: FormData) {
  const cle = await equipeEcriture();

  const convention = str(formData, "convention") as Convention | null;
  const cachet = str(formData, "cachet") as Cachet | null;
  const montant = num(formData, "montant_brut");
  if (!convention || !cachet || montant === null) {
    return { error: "Convention, cachet et montant sont obligatoires." };
  }

  const supabase = createAdminClient();
  await preparerBaremeEquipe(supabase, cle);
  const { error } = await supabase.from("bareme_cachets").insert({
    convention,
    cachet,
    montant_brut: montant,
    date_effet: str(formData, "date_effet") ?? new Date().toISOString().slice(0, 10),
    notes: str(formData, "notes"),
    equipe_id: cle,
  });
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function updateBaremeCachet(id: string, montantBrut: number, notes: string | null) {
  const cle = await equipeEcriture();
  if (typeof montantBrut !== "number" || !Number.isFinite(montantBrut)) return { error: "Montant invalide." };

  const supabase = createAdminClient();
  const ligne = await ligneEquipe(supabase, "bareme_cachets", cle, id);
  if (!ligne) return { error: "Ligne du barème introuvable." };
  const { data, error } = await supabase
    .from("bareme_cachets")
    .update({ montant_brut: montantBrut, notes })
    .eq("id", ligne)
    .eq("equipe_id", cle)
    .select("id");
  if (error || data?.length !== 1) return { error: "Le montant n'a pas pu être enregistré." };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function deleteBaremeCachet(id: string) {
  const cle = await equipeEcriture();

  const supabase = createAdminClient();
  const ligne = await ligneEquipe(supabase, "bareme_cachets", cle, id);
  if (!ligne) throw new Error("Ligne du barème introuvable.");
  const { error } = await supabase.from("bareme_cachets").delete().eq("id", ligne).eq("equipe_id", cle);
  if (error) throw new Error("La ligne n'a pas pu être supprimée.");
  revalidatePath("/bareme");
}

export async function createBaremeMajoration(_prevState: unknown, formData: FormData) {
  const cle = await equipeEcriture();

  const convention = str(formData, "convention") as Convention | null;
  const label = str(formData, "label");
  const valeurType = str(formData, "valeur_type") as MajorationValeurType | null;
  if (!convention || !label || !valeurType) {
    return { error: "Convention, libellé et type de valeur sont obligatoires." };
  }

  const supabase = createAdminClient();
  await preparerBaremeEquipe(supabase, cle);
  const { error } = await supabase.from("bareme_majorations").insert({
    convention,
    type: str(formData, "type") ?? label.toLowerCase().replace(/\s+/g, "_"),
    label,
    valeur_type: valeurType,
    valeur: num(formData, "valeur"),
    cinema_uniquement: formData.get("cinema_uniquement") === "on",
    notes: str(formData, "notes"),
    date_effet: str(formData, "date_effet") ?? new Date().toISOString().slice(0, 10),
    equipe_id: cle,
  });
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function updateBaremeMajoration(id: string, valeur: number | null, notes: string | null) {
  const cle = await equipeEcriture();
  if (valeur !== null && (typeof valeur !== "number" || !Number.isFinite(valeur))) return { error: "Valeur invalide." };

  const supabase = createAdminClient();
  const ligne = await ligneEquipe(supabase, "bareme_majorations", cle, id);
  if (!ligne) return { error: "Ligne du barème introuvable." };
  const { data, error } = await supabase
    .from("bareme_majorations")
    .update({ valeur, notes })
    .eq("id", ligne)
    .eq("equipe_id", cle)
    .select("id");
  if (error || data?.length !== 1) return { error: "La majoration n'a pas pu être enregistrée." };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function deleteBaremeMajoration(id: string) {
  const cle = await equipeEcriture();

  const supabase = createAdminClient();
  const ligne = await ligneEquipe(supabase, "bareme_majorations", cle, id);
  if (!ligne) throw new Error("Ligne du barème introuvable.");
  const { error } = await supabase.from("bareme_majorations").delete().eq("id", ligne).eq("equipe_id", cle);
  if (error) throw new Error("La majoration n'a pas pu être supprimée.");
  revalidatePath("/bareme");
}

export async function applyMajorationToBookings(bookingIds: string[], baremeMajorationId: string) {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) return { error: "Sélectionne au moins un profil." };
  if (bookingIds.length > 500) return { error: "Sélection trop grande." };
  const supabase = createAdminClient();

  const { data: targeted, error: targetedError } = await supabase.from("bookings").select("id, projet_id").in("id", bookingIds);
  if (targetedError || (targeted ?? []).length !== new Set(bookingIds).size) return { error: "Sélection de profils incomplète ou indisponible." };
  const projetIds = Array.from(new Set((targeted ?? []).map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  // La majoration doit appartenir au barème de l'équipe du projet (ou à la référence si l'équipe n'en a pas).
  const cles = await clesEquipeProjets(supabase, projetIds);
  if (new Set(cles.values()).size !== 1 || cles.size !== projetIds.length) return { error: "Sélectionne des profils d'un même projet." };
  const cle = [...cles.values()][0];
  const { majorations } = await baremePourEquipes(supabase, [cle]);
  if (!majorations.some((m) => m.id === baremeMajorationId)) return { error: "Majoration introuvable dans le barème de ce projet." };

  const rows = bookingIds.map((bookingId) => ({ booking_id: bookingId, bareme_majoration_id: baremeMajorationId }));
  const { error } = await supabase
    .from("booking_majorations")
    .upsert(rows, { onConflict: "booking_id,bareme_majoration_id" });
  if (error) return { error: error.message };

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function removeMajorationFromBooking(bookingId: string, baremeMajorationId: string) {
  const supabase = createAdminClient();
  const { data: booking, error: bookingError } = await supabase.from("bookings").select("projet_id").eq("id", bookingId).maybeSingle();
  if (bookingError || !booking) return { error: "Booking introuvable." };
  const accessError = await checkProjetAccess(booking.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase
    .from("booking_majorations")
    .delete()
    .eq("booking_id", bookingId)
    .eq("bareme_majoration_id", baremeMajorationId);
  if (error) return { error: "La majoration n'a pas pu être retirée." };
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
