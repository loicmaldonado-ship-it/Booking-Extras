"use server";

import { nomComplet } from "@/lib/noms";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkVisibleFigurants } from "@/lib/figurants/access";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { sendMagicLinkEmail, sendAccesCompteActiveEmail } from "@/lib/candidats/email";
import { aCreeSonCompte } from "@/lib/candidats/mot-de-passe";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import type { BookingStatut } from "./types";
import type { Cachet } from "@/lib/candidatures/types";
import { validateBookingDropSelection, isValidBookingDate } from "./drop-guard";
import { validateBookingBulkIds, validateBookingBulkChanges } from "./bulk-guard";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function friendlyError(message: string) {
  if (message.includes("booking_present_requiert_confirme")) {
    return "Impossible de passer à \"Présent\" : ce booking doit d'abord être passé par \"CONFIRMÉ\".";
  }
  return message;
}

function buildBookingPayload(fd: FormData) {
  return {
    figurant_id: str(fd, "figurant_id") ?? "",
    projet_id: str(fd, "projet_id") ?? "",
    date: str(fd, "date") ?? "",
    heure_convocation: str(fd, "heure_convocation"),
    fonction: str(fd, "fonction"),
    cachet: str(fd, "cachet") as Cachet | null,
    statut: (str(fd, "statut") ?? "envoyé") as BookingStatut,
    lien_myrole_envoye: fd.get("lien_myrole_envoye") === "on",
    convocation_envoyee: fd.get("convocation_envoyee") === "on",
    notes: str(fd, "notes"),
    covoiturage_role: str(fd, "covoiturage_role"),
    covoiturage_lieu_depart: str(fd, "covoiturage_lieu_depart"),
    covoiturage_places_disponibles: str(fd, "covoiturage_places_disponibles")
      ? Number(str(fd, "covoiturage_places_disponibles"))
      : null,
    covoiturage_conducteur_id: str(fd, "covoiturage_conducteur_id"),
  };
}

export async function createBooking(_prevState: unknown, formData: FormData) {
  const payload = buildBookingPayload(formData);
  if (!payload.figurant_id || !payload.projet_id || !payload.date) {
    return { error: "Figurant, projet et date sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const personError = await checkVisibleFigurants([payload.figurant_id, ...(payload.covoiturage_conducteur_id ? [payload.covoiturage_conducteur_id] : [])]);
  if (personError) return { error: personError };

  const supabase = createAdminClient();
  const { error: journeeError } = await supabase
    .from("journees")
    .upsert({ projet_id: payload.projet_id, date: payload.date }, { onConflict: "projet_id,date" });
  if (journeeError) return { error: "Impossible de préparer la journée de booking." };
  const { data, error } = await supabase.from("bookings").insert(payload).select("id").single();

  if (error) {
    return { error: friendlyError(error.message) };
  }

  const { error: profilError } = await supabase.from("figurants").update({ confirme: true }).eq("id", payload.figurant_id);
  revalidatePath("/figurants");
  revalidatePath("/bookings");
  if (profilError) return { error: "Le booking a été créé, mais le profil n’a pas pu être mis à jour. Vérifie le booking existant avant de réessayer." };
  redirect(`/bookings/${data.id}`);
}

export async function updateBooking(id: string, _prevState: unknown, formData: FormData) {
  const payload = buildBookingPayload(formData);
  if (!payload.figurant_id || !payload.projet_id || !payload.date) {
    return { error: "Figurant, projet et date sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const personError = await checkVisibleFigurants([payload.figurant_id, ...(payload.covoiturage_conducteur_id ? [payload.covoiturage_conducteur_id] : [])]);
  if (personError) return { error: personError };

  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (lookupError || !existing) return { error: "Impossible de vérifier ce booking." };
  const existingAccessError = await checkProjetAccess(existing.projet_id);
  if (existingAccessError) return { error: existingAccessError };
  // Une date changée ici doit exister comme journée, sinon le booking
  // n'apparaît plus dans aucune vue par journée.
  const { error: journeeError } = await supabase
    .from("journees")
    .upsert({ projet_id: payload.projet_id, date: payload.date }, { onConflict: "projet_id,date" });
  if (journeeError) return { error: "Impossible de préparer la journée de booking." };
  const { error } = await supabase.from("bookings").update(payload).eq("id", id);

  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  redirect(`/bookings/${id}`);
}

export async function deleteBooking(id: string) {
  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (lookupError || !existing) throw new Error("Impossible de vérifier ce booking.");
  const accessError = await checkProjetAccess(existing.projet_id);
  if (accessError) throw new Error(accessError);
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error("Impossible de supprimer ce booking.");
  revalidatePath("/bookings");
  redirect("/bookings");
}

// A candidate reference is not an authorization grant. The caller can forge
// the mapping, so match every referenced candidature to the intended person
// and project before writing any booking with service_role.
async function checkDropCandidatureReferences(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string,
  byFigurant: Record<string, string>
): Promise<string | null> {
  const ids = [...new Set(Object.values(byFigurant))];
  if (ids.length === 0) return null;
  const { data, error } = await supabase.from("candidatures")
    .select("id, figurant_id, annonces!inner(projet_id)")
    .in("id", ids)
    .returns<{ id: string; figurant_id: string; annonces: { projet_id: string } | null }[]>();
  if (error || !data || data.length !== ids.length) return "Candidature liée introuvable ou indisponible.";
  const byId = new Map(data.map((c) => [c.id, c]));
  for (const [figurantId, candidatureId] of Object.entries(byFigurant)) {
    const row = byId.get(candidatureId);
    if (!row || row.figurant_id !== figurantId || row.annonces?.projet_id !== projetId) {
      return "Cette candidature ne correspond pas au figurant ou au projet sélectionné.";
    }
  }
  return null;
}

export async function createBookingFromDrop(
  figurantId: string,
  projetId: string,
  date: string,
  candidatureId?: string,
  fonction?: string,
  cachet?: Cachet | ""
) {
  const selection = validateBookingDropSelection([figurantId], [date],
    candidatureId ? { [figurantId]: candidatureId } : undefined);
  if (!selection.ok) return { error: selection.error };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const personError = await checkVisibleFigurants([figurantId]);
  if (personError) return { error: personError };

  const supabase = createAdminClient();
  const candidatureError = await checkDropCandidatureReferences(
    supabase, projetId, candidatureId ? { [figurantId]: candidatureId } : {});
  if (candidatureError) return { error: candidatureError };

  const { data: existing, error: existingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();

  if (existingError) return { error: "Impossible de vérifier les bookings existants." };
  if (existing) return { error: "Ce figurant est déjà booké ce jour-là sur ce projet." };

  const { error: journeeError } = await supabase.from("journees")
    .upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });
  if (journeeError) return { error: "Impossible de préparer la journée de booking." };

  const { error } = await supabase.from("bookings").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    date,
    candidature_id: candidatureId ?? null,
    fonction: fonction?.trim() || null,
    cachet: cachet || null,
  });

  if (error) return { error: error.message };

  // Transfert vers une journée = le figurant devient "confirmé" (visible
  // dans Base Profils). L'accès à l'espace personnel, lui, ne s'active que
  // lorsque le booking passe réellement au statut "confirmé".
  const { error: confirmedError } = await supabase.from("figurants")
    .update({ confirme: true }).eq("id", figurantId);

  revalidatePath("/bookings/planning");
  revalidatePath("/candidatures");
  revalidatePath("/figurants");
  if (confirmedError) return { error: "Booking créé, mais la fiche figurant n'a pas pu être confirmée." };
  return { success: true };
}

// Même opération que createBookingFromDrop, mais pour toute une sélection
// de profils × dates en un seul aller-retour serveur — la version "un par
// un" (200 appels séquentiels, chacun avec son propre check d'accès, ses
// requêtes et ses revalidatePath) prenait plusieurs minutes dès qu'on
// bookait beaucoup de monde d'un coup. Ici : un seul check d'accès, un seul
// select pour repérer les doublons, un seul upsert des journées, un seul
// insert groupé, une seule mise à jour "confirmé".
export async function createBookingsFromDropBulk(
  figurantIds: string[],
  projetId: string,
  dates: string[],
  candidatureIdByFigurant: Record<string, string> | undefined,
  fonction: string,
  cachet: Cachet | "",
  // Depuis Candidatures, la fonction peut attendre (cachet obligatoire).
  fonctionFacultative = false
): Promise<{ ok: number; deja: number; error?: string }> {
  const selection = validateBookingDropSelection(figurantIds, dates, candidatureIdByFigurant);
  if (!selection.ok) return { ok: 0, deja: 0, error: selection.error };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ok: 0, deja: 0, error: accessError };
  if (figurantIds.length === 0 || dates.length === 0) return { ok: 0, deja: 0 };
  // Envoi dans une journée de booking : fonction et cachet obligatoires.
  if (!cachet) return { ok: 0, deja: 0, error: "Choisis un cachet." };
  if (!fonctionFacultative && !fonction.trim()) return { ok: 0, deja: 0, error: "Choisis une fonction." };

  const personError = await checkVisibleFigurants(figurantIds);
  if (personError) return { ok: 0, deja: 0, error: personError };

  const supabase = createAdminClient();
  const candidatureError = await checkDropCandidatureReferences(
    supabase, projetId, candidatureIdByFigurant ?? {});
  if (candidatureError) return { ok: 0, deja: 0, error: candidatureError };

  const { data: existingRows, error: existingError } = await supabase
    .from("bookings")
    .select("figurant_id, date")
    .eq("projet_id", projetId)
    .in("figurant_id", figurantIds)
    .in("date", dates);
  if (existingError || !existingRows) return { ok: 0, deja: 0, error: "Bookings existants indisponibles." };
  const existingKeys = new Set(existingRows.map((r) => `${r.figurant_id}|${r.date}`));

  const { error: journeesError } = await supabase
    .from("journees")
    .upsert(
      dates.map((date) => ({ projet_id: projetId, date })),
      { onConflict: "projet_id,date" }
    );
  if (journeesError) return { ok: 0, deja: 0, error: "Création des journées impossible." };

  const payload: {
    figurant_id: string;
    projet_id: string;
    date: string;
    candidature_id: string | null;
    fonction: string | null;
    cachet: string | null;
  }[] = [];
  let deja = 0;
  for (const date of dates) {
    for (const figurantId of figurantIds) {
      if (existingKeys.has(`${figurantId}|${date}`)) {
        deja += 1;
        continue;
      }
      payload.push({
        figurant_id: figurantId,
        projet_id: projetId,
        date,
        candidature_id: candidatureIdByFigurant?.[figurantId] ?? null,
        fonction: fonction.trim() || null,
        cachet: cachet || null,
      });
    }
  }

  if (payload.length > 0) {
    const { error } = await supabase.from("bookings").insert(payload);
    if (error) return { ok: 0, deja, error: error.message };
    const { error: confirmedError } = await supabase.from("figurants")
      .update({ confirme: true }).in("id", figurantIds);
    if (confirmedError) {
      revalidatePath("/bookings/planning");
      revalidatePath("/candidatures");
      return { ok: payload.length, deja,
        error: "Bookings créés, mais la confirmation des fiches a échoué. Vérifie les profils." };
    }
  }

  revalidatePath("/bookings/planning");
  revalidatePath("/candidatures");
  revalidatePath("/figurants");
  return { ok: payload.length, deja };
}

export async function createJournee(projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) throw new Error(accessError);

  const date = str(formData, "date");
  if (!date) return;

  const supabase = createAdminClient();
  await supabase.from("journees").upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });

  revalidatePath("/bookings");
  redirect(`/bookings/documents?projet_id=${projetId}&date=${date}`);
}

export async function deleteJournee(journeeId: string) {
  const supabase = createAdminClient();
  const { data: journee } = await supabase
    .from("journees")
    .select("projet_id, date")
    .eq("id", journeeId)
    .maybeSingle();
  if (!journee) return { error: "Journée introuvable." };

  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) return { error: accessError };

  const { count, error: countError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("projet_id", journee.projet_id)
    .eq("date", journee.date);
  if (countError || count === null) return { error: "Impossible de vérifier si la journée est vide." };
  if (count > 0) return { error: "Cette journée contient encore des bookings." };

  const { error } = await supabase.from("journees").delete().eq("id", journeeId);
  if (error) return { error: error.message };

  revalidatePath("/bookings");
  return { ok: true };
}

export async function updateTotalJournee(journeeId: string, _prevState: unknown, formData: FormData) {
  const raw = str(formData, "total_requis");
  const total = raw ? Number(raw) : null;
  if (raw && (!Number.isInteger(total) || total === null || total <= 0 || total > 100000)) {
    return { error: "Total invalide." };
  }

  const supabase = createAdminClient();
  const { data: journee, error: lookupError } = await supabase.from("journees")
    .select("projet_id").eq("id", journeeId).maybeSingle();
  if (lookupError || !journee) return { error: "Journée introuvable ou indisponible." };
  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase.from("journees").update({ total_requis: total }).eq("id", journeeId);
  if (error) return { error: error.message };

  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function updateConvocationSettings(journeeId: string, _prevState: unknown, formData: FormData) {
  const supabase = createAdminClient();
  const { data: journee, error: lookupError } = await supabase.from("journees")
    .select("projet_id").eq("id", journeeId).maybeSingle();
  if (lookupError || !journee) return { error: "Journée introuvable ou indisponible." };
  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase
    .from("journees")
    .update({
      lieu: str(formData, "lieu"),
      convocation_precisions: str(formData, "convocation_precisions"),
      convocation_hmc: str(formData, "convocation_hmc"),
      convocation_accessoires: str(formData, "convocation_accessoires"),
      convocation_commentaires: str(formData, "convocation_commentaires"),
    })
    .eq("id", journeeId);
  if (error) return { error: error.message };

  revalidatePath("/bookings/documents");
  return { success: true as const };
}

// Retire des profils d'une journée (suppression des bookings sélectionnés).
// Les passager·ères d'un·e conducteur·rice retiré·e perdent leur covoiturage.
export async function retirerBookings(ids: string[]): Promise<{ retires: number; error?: string }> {
  if (ids.length === 0) return { retires: 0 };
  const supabase = createAdminClient();
  const { data: bookings, error: lectureError } = await supabase
    .from("bookings")
    .select("id, projet_id, date, figurant_id")
    .in("id", ids);
  if (lectureError) return { retires: 0, error: lectureError.message };
  const list = bookings ?? [];
  const projetIds = Array.from(new Set(list.map((b) => b.projet_id)));
  if (projetIds.length !== 1) return { retires: 0, error: "Sélection sur plusieurs projets." };
  const accessError = await checkProjetAccess(projetIds[0]);
  if (accessError) return { retires: 0, error: accessError };

  const { error } = await supabase.from("bookings").delete().in("id", list.map((b) => b.id));
  if (error) return { retires: 0, error: error.message };

  for (const date of Array.from(new Set(list.map((b) => b.date)))) {
    await supabase
      .from("bookings")
      .update({ covoiturage_conducteur_id: null })
      .eq("projet_id", projetIds[0])
      .eq("date", date)
      .in("covoiturage_conducteur_id", list.filter((b) => b.date === date).map((b) => b.figurant_id));
  }

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  revalidatePath("/bookings/planning");
  return { retires: list.length };
}

export async function bulkUpdateBookings(
  ids: string[],
  changes: Partial<{
    statut: BookingStatut;
    fonction: string | null;
    cachet: string | null;
    heure_convocation: string | null;
    covoiturage_role: string | null;
    covoiturage_lieu_depart: string | null;
    covoiturage_places_disponibles: number | null;
    covoiturage_conducteur_id: string | null;
    reponse_recue: boolean;
    reponse_booking: boolean;
    notes: string | null;
  }>
) {
  const selection = validateBookingBulkIds(ids);
  if (!selection.ok) return { error: selection.error };
  if (selection.ids.length === 0) return {};
  const update = validateBookingBulkChanges(changes);
  if (!update.ok) return { error: update.error };
  if (changes.covoiturage_conducteur_id) {
    const personError = await checkVisibleFigurants([changes.covoiturage_conducteur_id]);
    if (personError) return { error: personError };
  }
  const supabase = createAdminClient();

  const { data: targeted, error: lookupError } = await supabase.from("bookings")
    .select("id, projet_id").in("id", selection.ids);
  if (lookupError || !targeted || targeted.length !== selection.ids.length ||
      new Set(targeted.map((r) => r.id)).size !== selection.ids.length) {
    return { error: "Sélection de bookings incomplète ou indisponible." };
  }
  const projetIds = Array.from(new Set(targeted.map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  const payload: typeof changes & { reponse_recue_le?: string | null; reponse_booking_le?: string | null; statut?: string } = {
    ...changes,
  };
  if (changes.reponse_recue !== undefined) {
    payload.reponse_recue_le = changes.reponse_recue ? new Date().toISOString() : null;
  }
  // « Répondu booking » coché : la personne a accepté, elle passe en
  // CONFIRMÉ. Décoché : seule la case est retirée, le statut ne bouge pas.
  if (changes.reponse_booking !== undefined) {
    payload.reponse_booking_le = changes.reponse_booking ? new Date().toISOString() : null;
    if (changes.reponse_booking) payload.statut = "confirmé";
  }

  const { data: updated, error } = await supabase.from("bookings")
    .update(payload).in("id", selection.ids).select("id");
  if (error || !updated || updated.length !== selection.ids.length) {
    return { error: error ? friendlyError(error.message) : "Mise à jour incomplète. Actualise la liste." };
  }

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return {};
}

// Déplace des bookings vers une autre date du même projet (journée créée
// si besoin). Ce qui ne vaut que pour l'ancienne date est remis à zéro :
// convocation envoyée, "bien reçu", et le covoiturage croisé (un passager
// déplacé n'est plus dans la voiture de son conducteur, et les passagers
// restés sur l'ancienne date perdent un conducteur déplacé). Une personne
// déjà bookée à la nouvelle date sur ce projet n'est pas déplacée.
export async function moveBookingsToDate(
  ids: string[],
  newDate: string,
  repasserEnPer: boolean
): Promise<{ moved: number; conflits: string[]; restantIds: string[]; error?: string }> {
  const vide = { moved: 0, conflits: [] as string[], restantIds: ids };
  if (ids.length === 0) return vide;
  if (!isValidBookingDate(newDate)) return { ...vide, error: "Date invalide." };
  const selection = validateBookingBulkIds(ids);
  if (!selection.ok) return { ...vide, error: selection.error };

  const supabase = createAdminClient();
  const { data: bookings, error: readError } = await supabase
    .from("bookings")
    .select("id, projet_id, date, figurant_id, figurants!bookings_figurant_id_fkey(prenom, nom)")
    .in("id", ids)
    .returns<{ id: string; projet_id: string; date: string; figurant_id: string; figurants: { prenom: string; nom: string } | null }[]>();
  if (readError || !bookings || bookings.length !== ids.length) {
    return { ...vide, error: "Sélection de bookings incomplète ou indisponible." };
  }
  const list = bookings;
  const projetIds = Array.from(new Set(list.map((b) => b.projet_id)));
  if (projetIds.length !== 1) return { ...vide, error: "Sélection sur plusieurs projets." };
  const projetId = projetIds[0];
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ...vide, error: accessError };

  const aDeplacer = list.filter((b) => b.date !== newDate);
  const { data: dejaLa, error: conflictsError } = await supabase
    .from("bookings")
    .select("figurant_id")
    .eq("projet_id", projetId)
    .eq("date", newDate)
    .in("figurant_id", aDeplacer.map((b) => b.figurant_id));
  if (conflictsError || !dejaLa) return { ...vide, error: "Impossible de vérifier les conflits de dates." };
  const dejaLaIds = new Set(dejaLa.map((b) => b.figurant_id));
  const conflits = aDeplacer
    .filter((b) => dejaLaIds.has(b.figurant_id))
    .map((b) => (b.figurants ? nomComplet(b.figurants) : "?"));
  const moves = aDeplacer.filter((b) => !dejaLaIds.has(b.figurant_id));
  const restantIds = list.filter((b) => !moves.includes(b)).map((b) => b.id);
  if (moves.length === 0) return { moved: 0, conflits, restantIds };

  const { error: upsertError } = await supabase.from("journees")
    .upsert({ projet_id: projetId, date: newDate }, { onConflict: "projet_id,date" });
  if (upsertError) return { ...vide, error: "Impossible de préparer la journée cible." };

  const { error } = await supabase
    .from("bookings")
    .update({
      date: newDate,
      convocation_envoyee: false,
      convocation_envoyee_le: null,
      reponse_recue: false,
      reponse_recue_le: null,
      covoiturage_conducteur_id: null,
      ...(repasserEnPer ? { statut: "envoyé" as BookingStatut } : {}),
    })
    .in("id", moves.map((b) => b.id));
  if (error) return { moved: 0, conflits, restantIds: ids, error: friendlyError(error.message) };

  for (const oldDate of Array.from(new Set(moves.map((b) => b.date)))) {
    await supabase
      .from("bookings")
      .update({ covoiturage_conducteur_id: null })
      .eq("projet_id", projetId)
      .eq("date", oldDate)
      .in("covoiturage_conducteur_id", moves.filter((b) => b.date === oldDate).map((b) => b.figurant_id));
  }

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  revalidatePath("/bookings/planning");
  return { moved: moves.length, conflits, restantIds };
}

export async function markConvocationEnvoyee(id: string) {
  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (lookupError || !existing) return { error: "Impossible de vérifier ce booking." };
  const accessError = await checkProjetAccess(existing.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase.from("bookings")
    .update({ convocation_envoyee: true, convocation_envoyee_le: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Impossible d’enregistrer le statut de convocation." };
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  revalidatePath(`/bookings/${id}`);
  return { success: true as const };
}

// Permet de renvoyer une convocation déjà reçue — geste explicite du staff,
// distinct d'un simple bouton "renvoyer" pour éviter les doublons accidentels.
export async function resetConvocationEnvoyee(ids: string[]) {
  const selection = validateBookingBulkIds(ids);
  if (!selection.ok) return { error: selection.error };
  if (selection.ids.length === 0) return {};
  const supabase = createAdminClient();
  const { data: targeted, error: lookupError } = await supabase.from("bookings").select("id, projet_id").in("id", selection.ids);
  const returnedIds = new Set((targeted ?? []).map((b) => b.id));
  if (lookupError || !targeted || targeted.length !== selection.ids.length ||
      returnedIds.size !== selection.ids.length || selection.ids.some((id) => !returnedIds.has(id))) {
    return { error: "Impossible de vérifier tous les bookings sélectionnés." };
  }
  for (const projetId of new Set(targeted.map((b) => b.projet_id))) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }
  const { error } = await supabase.from("bookings").update({ convocation_envoyee: false, convocation_envoyee_le: null }).in("id", selection.ids);
  if (error) return { error: "Impossible de réinitialiser les convocations." };
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

// Enregistre la convocation comme message interne lié à ce booking, pour que
// le "BIEN REÇU" du candidat marque automatiquement reponse_recue et
// déclenche la surbrillance jaune fluo dans Booking. Envoie aussi le vrai
// email (boîte Gmail partagée) quand une adresse est fournie.
export async function recordConvocationMessage(
  bookingId: string,
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "convocation", bookingId, email, subject, projetId });
}

// bookingId permet au clic "BIEN REÇU" du candidat de marquer directement
// reponse_recue sur ce booking (comme pour la convocation) — sans ça, une
// réponse à un message libre ne remontait nulle part côté booking.
export async function recordBookingMessage(
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null,
  bookingId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "booking", email, subject, projetId, bookingId });
}

// Reprend l'organisation covoiturage (rôle, lieu, places, conducteur·rice)
// d'une journée vers une autre du même projet — utile quand les mêmes
// personnes sont raccord (rebookées) un autre jour et qu'on ne veut pas
// tout refaire à la main. Ne touche que les figurant·es réellement bookés
// les deux jours ; les autres sont ignorés silencieusement (rien à copier
// dessus). Un seul appel par combinaison de changements identiques (tous
// les passager·ères d'un même conducteur, par exemple) plutôt qu'un par
// personne.
export async function copyCovoiturageToDate(projetId: string, fromDate: string, toDate: string) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (!toDate || fromDate === toDate) return { error: "Choisis une autre date." };

  const supabase = createAdminClient();
  const [{ data: sourceRows }, { data: targetRows }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "figurant_id, covoiturage_role, covoiturage_lieu_depart, covoiturage_places_disponibles, covoiturage_conducteur_id"
      )
      .eq("projet_id", projetId)
      .eq("date", fromDate)
      .not("covoiturage_role", "is", null),
    supabase.from("bookings").select("id, figurant_id").eq("projet_id", projetId).eq("date", toDate),
  ]);

  const targetIdByFigurant = new Map((targetRows ?? []).map((r) => [r.figurant_id, r.id]));

  type Changes = {
    covoiturage_role: string | null;
    covoiturage_lieu_depart: string | null;
    covoiturage_places_disponibles: number | null;
    covoiturage_conducteur_id: string | null;
  };
  const groups = new Map<string, { changes: Changes; ids: string[] }>();
  for (const row of sourceRows ?? []) {
    const targetId = targetIdByFigurant.get(row.figurant_id);
    if (!targetId) continue;
    const changes: Changes = {
      covoiturage_role: row.covoiturage_role,
      covoiturage_lieu_depart: row.covoiturage_lieu_depart,
      covoiturage_places_disponibles: row.covoiturage_places_disponibles,
      covoiturage_conducteur_id: row.covoiturage_conducteur_id,
    };
    const key = JSON.stringify(changes);
    const group = groups.get(key) ?? { changes, ids: [] };
    group.ids.push(targetId);
    groups.set(key, group);
  }

  if (groups.size === 0) return { applied: 0 };

  let applied = 0;
  for (const { changes, ids } of groups.values()) {
    const result = await bulkUpdateBookings(ids, changes);
    if (result.error) return { error: result.error };
    applied += ids.length;
  }

  return { applied };
}

export async function recordCovoiturageMessage(
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "covoiturage", email, subject, projetId });
}

// Une convocation déjà reçue ne repart jamais toute seule — il faut la
// réinitialiser explicitement (resetConvocationEnvoyee) avant de pouvoir la
// renvoyer. Re-vérifié ici côté serveur (pas seulement dans l'UI) au cas où
// convocation_envoyee aurait changé entre-temps.
export async function sendBulkConvocations(
  rows: { bookingId: string; figurantId: string; email: string; corps: string; subject: string }[],
  projetId?: string | null
) {
  const failedResult = { sent: 0, failed: Array.isArray(rows) ? rows.length : 0, skipped: 0, unmarked: 0 };
  const actor = await getCurrentProfile();
  if (!actor || !Array.isArray(rows) || !rows.length || rows.length > 500 || new Set(rows.map(r => r.bookingId)).size !== rows.length) return failedResult;
  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase.from("bookings")
    .select("id, projet_id, figurant_id, convocation_envoyee").in("id", rows.map(r => r.bookingId));
  if (lookupError || !existing || existing.length !== rows.length) return failedResult;
  for (const booking of existing) {
    if ((projetId && booking.projet_id !== projetId) || rows.find(r => r.bookingId === booking.id)?.figurantId !== booking.figurant_id || await checkProjetAccess(booking.projet_id)) return failedResult;
  }
  const dejaEnvoyees = new Set(existing.filter(b => b.convocation_envoyee).map(b => b.id));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let unmarked = 0;
  for (const r of rows) {
    if (dejaEnvoyees.has(r.bookingId)) {
      skipped += 1;
      continue;
    }
    const result = await recordFigurantMessage({
      figurantId: r.figurantId,
      corps: r.corps,
      categorie: "convocation",
      bookingId: r.bookingId,
      email: r.email,
      subject: r.subject,
      projetId,
    });
    if (result.error) {
      failed += 1;
      continue;
    }
    const marked = await markConvocationEnvoyee(r.bookingId);
    if (marked.error) unmarked += 1;
    sent += 1;
  }
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { sent, failed, skipped, unmarked };
}

// Envoi manuel du lien d'espace perso à toute une sélection (ex. au moment
// des convocations, pour que chacun aille consulter sa fiche) — envoie
// toujours, contrairement à activerAccesCompte qui ne repart qu'une fois
// par projet ; enregistre l'événement pour éviter un renvoi automatique
// redondant plus tard sur ce même projet.
export async function sendEspacePersoLinkBulk(figurantIds: string[], projetId: string) {
  if (figurantIds.length === 0) return { error: "Sélectionne au moins un profil." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const personError = await checkVisibleFigurants(figurantIds);
  if (personError) return { error: personError };
  const supabase = createAdminClient();
  const { data: linked, error: linkError } = await supabase.from("bookings")
    .select("figurant_id").eq("projet_id", projetId).in("figurant_id", figurantIds);
  if (linkError || !linked || new Set(linked.map((row) => row.figurant_id)).size !== new Set(figurantIds).size) {
    return { error: "La sélection contient un profil absent de ce projet." };
  }
  let sent = 0;
  let failed = 0;
  let dejaCompte = 0;
  let lastError: string | undefined;

  for (const figurantId of Array.from(new Set(figurantIds))) {
    const { data: figurant, error: profilError } = await supabase
      .from("figurants")
      .select("id, prenom, email, acces_compte")
      .eq("id", figurantId)
      .maybeSingle();

    if (profilError || !figurant?.email) {
      failed += 1;
      lastError = profilError ? "Impossible de vérifier le profil." : "Adresse email absente.";
      continue;
    }
    // Compte créé par la personne elle-même (mot de passe) : elle se
    // connecte seule, le lien ne sert qu'aux profils ajoutés à la main.
    try {
      if (await aCreeSonCompte(figurant.id)) {
        dejaCompte += 1;
        continue;
      }
    } catch {
      failed += 1;
      lastError = "Impossible de vérifier le compte candidat.";
      continue;
    }

    if (!figurant.acces_compte) {
      const { error: activationError } = await supabase.from("figurants").update({ acces_compte: true }).eq("id", figurantId);
      if (activationError) {
        failed += 1;
        lastError = "Impossible d’activer l’accès candidat.";
        continue;
      }
    }

    const result = figurant.acces_compte
      ? await sendMagicLinkEmail({ id: figurant.id, prenom: figurant.prenom, email: figurant.email }, projetId)
      : await sendAccesCompteActiveEmail(
          { id: figurant.id, prenom: figurant.prenom, email: figurant.email },
          projetId
        );

    if (result.error) {
      failed += 1;
      lastError = result.error;
      continue;
    }

    await supabase.from("figurant_messages").insert({
      figurant_id: figurantId,
      projet_id: projetId,
      sender: "staff",
      envoye_par: (await getCurrentProfile())?.id ?? null,
      corps: "Lien d'accès à l'espace personnel envoyé.",
      categorie: "espace_perso",
    });
    sent += 1;
  }

  revalidatePath("/bookings");
  revalidatePath("/figurants");
  return { sent, failed, dejaCompte, lastError };
}
