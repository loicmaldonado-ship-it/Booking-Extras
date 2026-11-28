"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

export async function createProjetIndemnite(projetId: string, label: string, montant: number) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (!label.trim() || !Number.isFinite(montant)) return { error: "Libellé et montant requis." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projet_indemnites")
    .insert({ projet_id: projetId, label: label.trim(), montant });
  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}/modifier`);
  revalidatePath("/bookings");
  return { success: true as const };
}

export async function deleteProjetIndemnite(id: string) {
  const supabase = createAdminClient();
  // BUG-13 : sans lecture réussie, pas de suppression (le contrôle d'accès était sauté si la lecture échouait).
  const { data: existing, error: readError } = await supabase.from("projet_indemnites").select("projet_id").eq("id", id).maybeSingle();
  if (readError) return { error: "Impossible de vérifier cette indemnité. Rien n'a été supprimé." };
  if (!existing) return { error: "Indemnité introuvable." };
  const accessError = await checkProjetAccess(existing.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase.from("projet_indemnites").delete().eq("id", id);
  if (error) return { error: "La suppression de l'indemnité a échoué ; réessaie." };
  revalidatePath(`/projets/${existing.projet_id}/modifier`);
  revalidatePath("/bookings");
  return { success: true as const };
}

export async function applyIndemniteToBookings(bookingIds: string[], projetIndemniteId: string) {
  if (bookingIds.length === 0) return { error: "Sélectionne au moins un profil." };
  const supabase = createAdminClient();

  // BUG-13 : sélection entièrement lue et indemnité du même projet, sinon aucun contrôle d'accès n'était fait.
  const ids = Array.from(new Set(bookingIds));
  const { data: targeted, error: readError } = await supabase.from("bookings").select("projet_id").in("id", ids);
  if (readError || (targeted ?? []).length !== ids.length) return { error: "Impossible de vérifier la sélection. Rien n'a été appliqué." };
  const projetIds = Array.from(new Set((targeted ?? []).map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }
  const { data: indemnite, error: indemniteError } = await supabase.from("projet_indemnites").select("projet_id").eq("id", projetIndemniteId).maybeSingle();
  if (indemniteError || !indemnite || projetIds.some((p) => p !== indemnite.projet_id)) {
    return { error: "Cette indemnité n'appartient pas au projet de la sélection." };
  }

  const rows = ids.map((bookingId) => ({ booking_id: bookingId, projet_indemnite_id: projetIndemniteId }));
  const { error } = await supabase
    .from("booking_indemnites")
    .upsert(rows, { onConflict: "booking_id,projet_indemnite_id" });
  if (error) return { error: error.message };

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function removeIndemniteFromBooking(bookingId: string, projetIndemniteId: string) {
  const supabase = createAdminClient();
  const { data: booking, error: readError } = await supabase.from("bookings").select("projet_id").eq("id", bookingId).maybeSingle();
  if (readError) return { error: "Impossible de vérifier ce booking. Rien n'a été retiré." };
  if (!booking) return { error: "Booking introuvable." };
  const accessError = await checkProjetAccess(booking.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase
    .from("booking_indemnites")
    .delete()
    .eq("booking_id", bookingId)
    .eq("projet_indemnite_id", projetIndemniteId);
  if (error) return { error: "Le retrait de l'indemnité a échoué ; réessaie." };
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
