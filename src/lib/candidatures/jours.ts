"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import type { Cachet } from "./types";

// Une journée de l'annonce est un onglet du classeur (créé avec la date) :
// ranger quelqu'un dans une journée = le mettre dans cet onglet, il n'a
// qu'une seule place. Aucun booking n'est créé ici.
async function ongletDeLaJournee(annonceDateId: string) {
  const { data } = await createAdminClient()
    .from("candidature_onglets")
    .select("id, annonce_id")
    .eq("annonce_date_id", annonceDateId)
    .maybeSingle();
  return data;
}

// Range (ou retire) une candidature dans la journée d'une date de son
// annonce. Retirer ne la renvoie dans « À trier » que si elle est bien dans
// cette journée.
export async function setCandidatureJour(
  candidatureId: string,
  annonceDateId: string,
  prevu: boolean
): Promise<{ error?: string }> {
  const res = await setCandidaturesJourBulk([candidatureId], annonceDateId, prevu);
  return res.error ? { error: res.error } : {};
}

// Même chose pour une sélection (rien n'est créé dans Bookings).
export async function setCandidaturesJourBulk(
  candidatureIds: string[],
  annonceDateId: string,
  prevu: boolean
): Promise<{ error?: string; n?: number }> {
  if (candidatureIds.length === 0) return { n: 0 };
  const supabase = createAdminClient();
  const { data: annonceDate } = await supabase
    .from("annonce_dates")
    .select("annonce_id, annonces(projet_id)")
    .eq("id", annonceDateId)
    .maybeSingle<{ annonce_id: string; annonces: { projet_id: string } | null }>();
  if (!annonceDate?.annonces) return { error: "Date introuvable." };
  const accessError = await checkProjetAccess(annonceDate.annonces.projet_id);
  if (accessError) return { error: accessError };
  const onglet = await ongletDeLaJournee(annonceDateId);
  if (!onglet) return { error: "Cette journée n'a pas d'onglet." };

  const { data: candidatures } = await supabase
    .from("candidatures")
    .select("id, onglet_id")
    .eq("annonce_id", annonceDate.annonce_id)
    .in("id", candidatureIds.slice(0, 300));
  const rows = candidatures ?? [];
  if (rows.length === 0) return { n: 0 };
  // Les profils rangés dans OUT n'en sortent pas par ici (OUT prévient la
  // personne : seul son onglet le gère).
  const { data: fixes, error: fixesError } = await supabase.from("candidature_onglets").select("id").eq("fixe", true);
  if (fixesError) return { error: "Impossible de vérifier les candidatures protégées. Réessaie." };
  const outIds = new Set((fixes ?? []).map((o) => o.id));
  const ids = rows.filter((c) => !c.onglet_id || !outIds.has(c.onglet_id)).map((c) => c.id);
  if (ids.length === 0) return { n: 0 };

  const { error } = prevu
    ? await supabase.from("candidatures").update({ onglet_id: onglet.id }).in("id", ids)
    : await supabase.from("candidatures").update({ onglet_id: null }).eq("onglet_id", onglet.id).in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return { n: ids.length };
}

// Envoie une sélection de candidatures dans la journée de tournage d'une
// date de leur annonce (panneau « Jours de tournage ») : un booking en PER
// par personne, comme envoyerJourAuTournage, sans passer par « prévu ».
export async function envoyerCandidaturesDansJour(
  annonceDateId: string,
  candidatureIds: string[],
  fonction: string,
  cachet: Cachet | ""
): Promise<{ ok: number; deja: number; error?: string }> {
  if (candidatureIds.length === 0) return { ok: 0, deja: 0 };
  // Depuis Candidatures : cachet obligatoire, fonction facultative.
  if (!cachet) return { ok: 0, deja: 0, error: "Choisis un cachet." };
  const supabase = createAdminClient();
  const { data: annonceDate } = await supabase
    .from("annonce_dates")
    .select("date, annonce_id, annonces(projet_id)")
    .eq("id", annonceDateId)
    .maybeSingle<{ date: string; annonce_id: string; annonces: { projet_id: string } | null }>();
  if (!annonceDate?.annonces) return { ok: 0, deja: 0, error: "Date introuvable." };
  const projetId = annonceDate.annonces.projet_id;
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ok: 0, deja: 0, error: accessError };

  const { data: candidatures } = await supabase
    .from("candidatures")
    .select("id, figurant_id, annonce_id")
    .in("id", candidatureIds.slice(0, 300));
  const rows = (candidatures ?? []).filter((c) => c.annonce_id === annonceDate.annonce_id);
  if (rows.length === 0) return { ok: 0, deja: 0, error: "Ces candidatures ne sont pas sur cette annonce." };

  const [{ data: existants }, { data: dejaRattachees }] = await Promise.all([
    supabase
      .from("bookings")
      .select("figurant_id")
      .eq("projet_id", projetId)
      .eq("date", annonceDate.date)
      .in("figurant_id", rows.map((r) => r.figurant_id)),
    supabase.from("bookings").select("candidature_id").in("candidature_id", rows.map((r) => r.id)),
  ]);
  const dejaBookes = new Set((existants ?? []).map((b) => b.figurant_id));
  const rattachees = new Set((dejaRattachees ?? []).map((b) => b.candidature_id));

  const payload = rows
    .filter((r) => !dejaBookes.has(r.figurant_id))
    .map((r) => ({
      figurant_id: r.figurant_id,
      projet_id: projetId,
      date: annonceDate.date,
      candidature_id: rattachees.has(r.id) ? null : r.id,
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

// Envoie en booking tout l'onglet d'une journée : crée, dans la journée de
// tournage correspondante (créée si besoin), un booking pour chaque profil
// rangé dans cet onglet, avec le statut de départ habituel (PER, comme
// createBookingsFromDropBulk) — rien n'est envoyé aux figurant·es. Ceux
// déjà bookés ce jour sur ce projet sont ignorés.
export async function envoyerJourAuTournage(
  annonceDateId: string,
  fonction: string,
  cachet: Cachet | ""
): Promise<{ ok: number; deja: number; error?: string }> {
  // Depuis Candidatures : cachet obligatoire, fonction facultative.
  if (!cachet) return { ok: 0, deja: 0, error: "Choisis un cachet." };
  const supabase = createAdminClient();
  const { data: annonceDate } = await supabase
    .from("annonce_dates")
    .select("annonce_id")
    .eq("id", annonceDateId)
    .maybeSingle();
  const onglet = annonceDate ? await ongletDeLaJournee(annonceDateId) : null;
  if (!annonceDate || !onglet) return { ok: 0, deja: 0, error: "Date introuvable." };

  const { data: rangees } = await supabase
    .from("candidatures")
    .select("id")
    .eq("annonce_id", annonceDate.annonce_id)
    .eq("onglet_id", onglet.id)
    .is("envoyee_en_booking_le", null)
    .limit(300);
  const ids = (rangees ?? []).map((c) => c.id);
  if (ids.length === 0) return { ok: 0, deja: 0 };
  return envoyerCandidaturesDansJour(annonceDateId, ids, fonction, cachet);
}
