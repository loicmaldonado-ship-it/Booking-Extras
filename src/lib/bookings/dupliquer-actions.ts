"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { checkProjetAccess } from "@/lib/auth/session";
import type { BookingStatut } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAQUET = 150;
const NON_REPRIS = new Set(["annulé", "indisponible", "a_rebooker"]);

type BookingSource = {
  id: string;
  figurant_id: string;
  statut: BookingStatut;
  heure_convocation: string | null;
  fonction: string | null;
  cachet: string | null;
  notes: string | null;
  covoiturage_role: string | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
};

// Duplique une journée vers une autre date : infos (lieu, convocation,
// total requis) et besoins par fonction, et en option les profils calés
// (hors annulé·es / indispos / à rebooker). Les profils déjà présents à la
// nouvelle date ne sont pas doublés. La journée d'origine ne bouge pas.
export async function dupliquerJournee(
  projetId: string,
  date: string,
  nouvelleDate: string,
  options: { avecProfils: boolean; repasserEnPer: boolean }
): Promise<{ error?: string; copies?: number; dejaLa?: number; indispos?: number; journeeCreee?: boolean }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (!DATE_RE.test(date) || !DATE_RE.test(nouvelleDate)) return { error: "Date invalide." };
  if (date === nouvelleDate) return { error: "Choisis une autre date que la journée actuelle." };
  const supabase = createAdminClient();

  const { data: source, error: sourceError } = await supabase
    .from("journees")
    .select("id, total_requis, lieu, convocation_precisions, convocation_hmc, convocation_accessoires, convocation_commentaires")
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();
  if (sourceError || !source) return { error: "Impossible de vérifier la journée source." };

  // Journée cible : créée avec les infos de la source, ou complétée si elle
  // existe déjà (ses propres infos sont gardées).
  const { data: existante, error: cibleError } = await supabase
    .from("journees")
    .select("id")
    .eq("projet_id", projetId)
    .eq("date", nouvelleDate)
    .maybeSingle();
  if (cibleError) return { error: "Impossible de vérifier la journée cible." };
  let cibleModifiee = false;
  const erreurPartielle = (detail: string) => {
    if (cibleModifiee) {
      revalidatePath("/bookings");
      revalidatePath("/bookings/documents");
      return { error: `La journée cible a été créée ou modifiée, mais ${detail}. Vérifie-la avant de réessayer.` };
    }
    return { error: `Impossible de dupliquer : ${detail}.` };
  };
  let cibleId = existante?.id ?? null;
  if (!cibleId) {
    const { data: creee, error } = await supabase
      .from("journees")
      .insert({
        projet_id: projetId,
        date: nouvelleDate,
        total_requis: source.total_requis,
        lieu: source.lieu,
        convocation_precisions: source.convocation_precisions,
        convocation_hmc: source.convocation_hmc,
        convocation_accessoires: source.convocation_accessoires,
        convocation_commentaires: source.convocation_commentaires,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    cibleId = creee.id;
    cibleModifiee = true;
  }

  const { data: besoins, error: besoinsError } = await supabase.from("journee_besoins").select("fonction, quantite").eq("journee_id", source.id);
  if (besoinsError) return erreurPartielle("la lecture des besoins a échoué");
  if (besoins && besoins.length > 0) {
    const { error: copieBesoinsError } = await supabase
      .from("journee_besoins")
      .upsert(
        besoins.map((b) => ({ ...b, journee_id: cibleId })),
        { onConflict: "journee_id,fonction", ignoreDuplicates: true }
      );
    if (copieBesoinsError) return erreurPartielle("la copie des besoins a échoué");
    cibleModifiee = true;
  }

  let copies = 0;
  let dejaLa = 0;
  let indispos = 0;
  if (options.avecProfils) {
    const { data: lus, error } = await fetchAll<BookingSource>((from, to) =>
      supabase
        .from("bookings")
        .select(
          "id, figurant_id, statut, heure_convocation, fonction, cachet, notes, covoiturage_role, covoiturage_lieu_depart, covoiturage_places_disponibles"
        )
        .eq("projet_id", projetId)
        .eq("date", date)
        .order("id")
        .range(from, to)
    );
    if (error) return erreurPartielle("la lecture des bookings a échoué");
    const repris = lus.filter((b) => !NON_REPRIS.has(b.statut));

    const figurantIds = repris.map((b) => b.figurant_id);
    const presents = new Set<string>();
    const indispoIds = new Set<string>();
    for (let i = 0; i < figurantIds.length; i += PAQUET) {
      const paquet = figurantIds.slice(i, i + PAQUET);
      const [{ data: la, error: presentsError }, { data: ind, error: indisposError }] = await Promise.all([
        supabase.from("bookings").select("figurant_id").eq("projet_id", projetId).eq("date", nouvelleDate).in("figurant_id", paquet),
        supabase.from("figurant_indisponibilites").select("figurant_id").eq("date", nouvelleDate).in("figurant_id", paquet),
      ]);
      if (presentsError || indisposError) return erreurPartielle("la vérification des bookings ou disponibilités a échoué");
      for (const b of la ?? []) presents.add(b.figurant_id);
      for (const x of ind ?? []) indispoIds.add(x.figurant_id);
    }
    const aCopier = repris.filter((b) => !presents.has(b.figurant_id));
    dejaLa = repris.length - aCopier.length;
    indispos = aCopier.filter((b) => indispoIds.has(b.figurant_id)).length;

    for (let i = 0; i < aCopier.length; i += 500) {
      const paquet = aCopier.slice(i, i + 500);
      const { data: crees, error: errInsert } = await supabase
        .from("bookings")
        .insert(
          paquet.map((b) => ({
            figurant_id: b.figurant_id,
            projet_id: projetId,
            date: nouvelleDate,
            statut: options.repasserEnPer ? "envoyé" : b.statut,
            heure_convocation: b.heure_convocation,
            fonction: b.fonction,
            cachet: b.cachet,
            notes: b.notes,
            covoiturage_role: b.covoiturage_role,
            covoiturage_lieu_depart: b.covoiturage_lieu_depart,
            covoiturage_places_disponibles: b.covoiturage_places_disponibles,
          }))
        )
        .select("id, figurant_id");
      if (errInsert) return erreurPartielle("la copie des bookings a échoué");
      copies += crees?.length ?? 0;
      if ((crees?.length ?? 0) > 0) cibleModifiee = true;

      // Les indemnités (transport…) suivent la personne.
      const nouveauParFigurant = new Map((crees ?? []).map((c) => [c.figurant_id, c.id]));
      const sourceParId = new Map(paquet.map((b) => [b.id, b.figurant_id]));
      const { data: indemnites, error: indemnitesError } = await supabase
        .from("booking_indemnites")
        .select("booking_id, projet_indemnite_id")
        .in("booking_id", paquet.map((b) => b.id));
      if (indemnitesError) return erreurPartielle("la lecture des indemnités a échoué");
      const lignes = (indemnites ?? [])
        .map((x) => ({ booking_id: nouveauParFigurant.get(sourceParId.get(x.booking_id) ?? ""), projet_indemnite_id: x.projet_indemnite_id }))
        .filter((x): x is { booking_id: string; projet_indemnite_id: string } => !!x.booking_id);
      if (lignes.length > 0) {
        const { error: indemnitesInsertError } = await supabase.from("booking_indemnites").insert(lignes);
        if (indemnitesInsertError) return erreurPartielle("la copie des indemnités a échoué");
      }
    }
    if (copies > 0) {
      const { error: profilsError } = await supabase.from("figurants").update({ confirme: true }).in("id", aCopier.map((b) => b.figurant_id));
      if (profilsError) return erreurPartielle("la mise à jour des profils a échoué");
    }
  }

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  return { copies, dejaLa, indispos, journeeCreee: !existante };
}
