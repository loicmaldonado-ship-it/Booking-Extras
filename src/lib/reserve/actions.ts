"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { retirerBookings } from "@/lib/bookings/actions";
import { getCandidatureParFigurant } from "@/lib/candidatures/documents";

// La réserve : profils mis de côté sur un projet, qu'on recontactera peut-être
// (on ne sait pas encore quoi en faire). Un profil par projet.

type LigneReserve = { projet_id: string; figurant_id: string; candidature_id: string | null; mis_par: string | null };

async function ajouter(lignes: LigneReserve[]): Promise<string | null> {
  if (lignes.length === 0) return null;
  const { error } = await createAdminClient()
    .from("reserve_profils")
    .upsert(lignes, { onConflict: "projet_id,figurant_id" });
  return error ? error.message : null;
}

// Depuis Candidatures : la candidature quitte la liste (voir la page) et
// le profil apparaît dans la réserve du projet, avec ce qu'il a envoyé.
export async function mettreCandidaturesEnReserve(candidatureIds: string[]): Promise<{ error?: string; n?: number }> {
  if (candidatureIds.length === 0) return { n: 0 };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("candidatures")
    .select("id, figurant_id, annonces(projet_id)")
    .in("id", candidatureIds.slice(0, 300))
    .returns<{ id: string; figurant_id: string; annonces: { projet_id: string } | null }[]>();
  const candidatures = (data ?? []).filter((c) => c.annonces);
  if (candidatures.length === 0) return { error: "Candidatures introuvables." };
  for (const projetId of new Set(candidatures.map((c) => c.annonces!.projet_id))) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }
  const profile = await getCurrentProfile();
  const error = await ajouter(
    candidatures.map((c) => ({
      projet_id: c.annonces!.projet_id,
      figurant_id: c.figurant_id,
      candidature_id: c.id,
      mis_par: profile?.id ?? null,
    }))
  );
  if (error) return { error };
  revalidatePath("/candidatures");
  revalidatePath("/bookings");
  return { n: candidatures.length };
}

// Depuis une journée de Bookings : le booking est retiré de la journée et le
// profil va en réserve, avec sa candidature d'origine si on la retrouve.
export async function mettreBookingsEnReserve(bookingIds: string[]): Promise<{ error?: string; n?: number }> {
  if (bookingIds.length === 0) return { n: 0 };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, projet_id, figurant_id, candidature_id")
    .in("id", bookingIds.slice(0, 300));
  const bookings = data ?? [];
  const projetIds = Array.from(new Set(bookings.map((b) => b.projet_id)));
  if (projetIds.length !== 1) return { error: "Sélection sur plusieurs projets." };
  const projetId = projetIds[0];
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const figurantIds = Array.from(new Set(bookings.map((b) => b.figurant_id)));
  const parFigurant = await getCandidatureParFigurant(projetId, figurantIds);
  const profile = await getCurrentProfile();
  const error = await ajouter(
    figurantIds.map((figurantId) => ({
      projet_id: projetId,
      figurant_id: figurantId,
      candidature_id:
        bookings.find((b) => b.figurant_id === figurantId && b.candidature_id)?.candidature_id ??
        parFigurant.get(figurantId) ??
        null,
      mis_par: profile?.id ?? null,
    }))
  );
  if (error) return { error };
  const retrait = await retirerBookings(bookings.map((b) => b.id));
  if (retrait.error) return { error: retrait.error };
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { n: figurantIds.length };
}

export async function retirerDeLaReserve(reserveIds: string[]): Promise<{ error?: string; n?: number }> {
  if (reserveIds.length === 0) return { n: 0 };
  const supabase = createAdminClient();
  const { data } = await supabase.from("reserve_profils").select("id, projet_id").in("id", reserveIds.slice(0, 300));
  const lignes = data ?? [];
  for (const projetId of new Set(lignes.map((l) => l.projet_id))) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }
  const { error } = await supabase.from("reserve_profils").delete().in("id", lignes.map((l) => l.id));
  if (error) return { error: error.message };
  revalidatePath("/bookings");
  revalidatePath("/candidatures");
  return { n: lignes.length };
}
