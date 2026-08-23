"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { activerAccesCompte, sendMagicLinkEmail, sendAccesCompteActiveEmail } from "@/lib/candidats/actions";
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

// Le lien d'espace personnel ne doit partir qu'une fois le booking
// réellement confirmé — sinon le figurant le reçoit avant même la
// proposition et ne comprend pas de quoi il s'agit.
async function syncAccesCompteSurConfirmation(
  figurantId: string,
  projetId: string,
  statut: BookingStatut | null | undefined
) {
  if (statut === "confirmé") {
    await activerAccesCompte(figurantId, projetId);
  }
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
  await syncAccesCompteSurConfirmation(payload.figurant_id, payload.projet_id, payload.statut);
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

  await syncAccesCompteSurConfirmation(payload.figurant_id, payload.projet_id, payload.statut);

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

  const { error } = await supabase.from("bookings").update(changes).in("id", ids);
  if (error) return { error: friendlyError(error.message) };

  if (changes.statut === "confirmé") {
    const { data: confirmes } = await supabase.from("bookings").select("figurant_id, projet_id").in("id", ids);
    const pairs = new Map<string, { figurantId: string; projetId: string }>();
    for (const b of confirmes ?? []) {
      pairs.set(`${b.figurant_id}|${b.projet_id}`, { figurantId: b.figurant_id, projetId: b.projet_id });
    }
    for (const { figurantId, projetId } of pairs.values()) {
      await activerAccesCompte(figurantId, projetId);
    }
  }

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
  await supabase.from("bookings").update({ convocation_envoyee: true }).eq("id", id);
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

  await supabase.from("bookings").update({ convocation_envoyee: false }).in("id", ids);
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

export async function recordBookingMessage(
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "booking", email, subject, projetId });
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
      ? await sendMagicLinkEmail({ id: figurant.id, prenom: figurant.prenom, email: figurant.email })
      : await sendAccesCompteActiveEmail({ id: figurant.id, prenom: figurant.prenom, email: figurant.email });

    if (result.error) {
      failed += 1;
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
  return { sent, failed };
}
