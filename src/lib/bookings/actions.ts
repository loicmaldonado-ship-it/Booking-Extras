"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { sendMagicLinkEmail, sendAccesCompteActiveEmail } from "@/lib/candidats/actions";
import { checkProjetAccess } from "@/lib/auth/session";
import type { BookingStatut } from "./types";
import type { Cachet } from "@/lib/candidatures/types";

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

  const supabase = createAdminClient();
  await supabase
    .from("journees")
    .upsert({ projet_id: payload.projet_id, date: payload.date }, { onConflict: "projet_id,date" });
  const { data, error } = await supabase.from("bookings").insert(payload).select("id").single();

  if (error) {
    return { error: friendlyError(error.message) };
  }

  await supabase.from("figurants").update({ confirme: true }).eq("id", payload.figurant_id);
  revalidatePath("/figurants");

  revalidatePath("/bookings");
  redirect(`/bookings/${data.id}`);
}

export async function updateBooking(id: string, _prevState: unknown, formData: FormData) {
  const payload = buildBookingPayload(formData);
  if (!payload.figurant_id || !payload.projet_id || !payload.date) {
    return { error: "Figurant, projet et date sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const existingAccessError = await checkProjetAccess(existing.projet_id);
    if (existingAccessError) return { error: existingAccessError };
  }
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
  const { data: existing } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("bookings").delete().eq("id", id);
  revalidatePath("/bookings");
  redirect("/bookings");
}

export async function createBookingFromDrop(
  figurantId: string,
  projetId: string,
  date: string,
  candidatureId?: string,
  fonction?: string,
  cachet?: Cachet | ""
) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();

  if (existing) return { error: "Ce figurant est déjà booké ce jour-là sur ce projet." };

  await supabase.from("journees").upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });

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
  await supabase.from("figurants").update({ confirme: true }).eq("id", figurantId);

  revalidatePath("/bookings/planning");
  revalidatePath("/candidatures");
  revalidatePath("/figurants");
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
  cachet: Cachet | ""
): Promise<{ ok: number; deja: number; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ok: 0, deja: 0, error: accessError };
  if (figurantIds.length === 0 || dates.length === 0) return { ok: 0, deja: 0 };

  const supabase = createAdminClient();

  const { data: existingRows } = await supabase
    .from("bookings")
    .select("figurant_id, date")
    .eq("projet_id", projetId)
    .in("figurant_id", figurantIds)
    .in("date", dates);
  const existingKeys = new Set((existingRows ?? []).map((r) => `${r.figurant_id}|${r.date}`));

  await supabase
    .from("journees")
    .upsert(
      dates.map((date) => ({ projet_id: projetId, date })),
      { onConflict: "projet_id,date" }
    );

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
    await supabase.from("figurants").update({ confirme: true }).in("id", figurantIds);
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

export async function updateTotalJournee(journeeId: string, _prevState: unknown, formData: FormData) {
  const raw = str(formData, "total_requis");
  const total = raw ? Number(raw) : null;
  if (raw && (!total || total <= 0)) return { error: "Total invalide." };

  const supabase = createAdminClient();
  const { data: journee } = await supabase.from("journees").select("projet_id").eq("id", journeeId).maybeSingle();
  if (journee) {
    const accessError = await checkProjetAccess(journee.projet_id);
    if (accessError) return { error: accessError };
  }
  const { error } = await supabase.from("journees").update({ total_requis: total }).eq("id", journeeId);
  if (error) return { error: error.message };

  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function updateConvocationSettings(journeeId: string, _prevState: unknown, formData: FormData) {
  const supabase = createAdminClient();
  const { data: journee } = await supabase.from("journees").select("projet_id").eq("id", journeeId).maybeSingle();
  if (journee) {
    const accessError = await checkProjetAccess(journee.projet_id);
    if (accessError) return { error: accessError };
  }
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

export async function removeBooking(id: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) return { error: accessError };
  }
  await supabase.from("bookings").delete().eq("id", id);
  revalidatePath("/bookings/planning");
  revalidatePath("/bookings");
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
    notes: string | null;
  }>
) {
  if (ids.length === 0) return {};
  const supabase = createAdminClient();

  const { data: targeted } = await supabase.from("bookings").select("projet_id").in("id", ids);
  const projetIds = Array.from(new Set((targeted ?? []).map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  const payload: typeof changes & { reponse_recue_le?: string | null } = { ...changes };
  if (changes.reponse_recue !== undefined) {
    payload.reponse_recue_le = changes.reponse_recue ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("bookings").update(payload).in("id", ids);
  if (error) return { error: friendlyError(error.message) };

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return {};
}

export async function markConvocationEnvoyee(id: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("bookings").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) return { error: accessError };
  }
  await supabase
    .from("bookings")
    .update({ convocation_envoyee: true, convocation_envoyee_le: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  revalidatePath(`/bookings/${id}`);
}

// Permet de renvoyer une convocation déjà reçue — geste explicite du staff,
// distinct d'un simple bouton "renvoyer" pour éviter les doublons accidentels.
export async function resetConvocationEnvoyee(ids: string[]) {
  if (ids.length === 0) return {};
  const supabase = createAdminClient();

  const { data: targeted } = await supabase.from("bookings").select("projet_id").in("id", ids);
  const projetIds = Array.from(new Set((targeted ?? []).map((b) => b.projet_id)));
  for (const projetId of projetIds) {
    const accessError = await checkProjetAccess(projetId);
    if (accessError) return { error: accessError };
  }

  await supabase.from("bookings").update({ convocation_envoyee: false, convocation_envoyee_le: null }).in("id", ids);
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
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("bookings")
    .select("id, convocation_envoyee")
    .in("id", rows.map((r) => r.bookingId));
  const dejaEnvoyees = new Set((existing ?? []).filter((b) => b.convocation_envoyee).map((b) => b.id));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
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
    await markConvocationEnvoyee(r.bookingId);
    sent += 1;
  }
  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { sent, failed, skipped };
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

  const supabase = createAdminClient();
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const figurantId of Array.from(new Set(figurantIds))) {
    const { data: figurant } = await supabase
      .from("figurants")
      .select("id, prenom, email, acces_compte")
      .eq("id", figurantId)
      .maybeSingle();

    if (!figurant?.email) {
      failed += 1;
      continue;
    }

    if (!figurant.acces_compte) {
      await supabase.from("figurants").update({ acces_compte: true }).eq("id", figurantId);
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
      corps: "Lien d'accès à l'espace personnel envoyé.",
      categorie: "espace_perso",
    });
    sent += 1;
  }

  revalidatePath("/bookings");
  revalidatePath("/figurants");
  return { sent, failed, lastError };
}
