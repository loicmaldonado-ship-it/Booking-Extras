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
  const { data: existing } = await supabase.from("projet_indemnites").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) return { error: accessError };
  }
  await supabase.from("projet_indemnites").delete().eq("id", id);
  if (existing) revalidatePath(`/projets/${existing.projet_id}/modifier`);
  revalidatePath("/bookings");
  return { success: true as const };
}

export async function applyIndemniteToBookings(bookingIds: string[], projetIndemniteId: string) {
  if (bookingIds.length === 0) return { error: "Sélectionne au moins un profil." };
  const supabase = createAdminClient();

  const { data: targeted } = await supabase.from("bookings").select("projet_id").in("id", bookingIds);
  const projetIds = Array.from(new Set((targeted ?? []).map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  const rows = bookingIds.map((bookingId) => ({ booking_id: bookingId, projet_indemnite_id: projetIndemniteId }));
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
  const { data: booking } = await supabase.from("bookings").select("projet_id").eq("id", bookingId).maybeSingle();
  if (booking) {
    const accessError = await checkProjetAccess(booking.projet_id);
    if (accessError) return { error: accessError };
  }
  await supabase
    .from("booking_indemnites")
    .delete()
    .eq("booking_id", bookingId)
    .eq("projet_indemnite_id", projetIndemniteId);
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
