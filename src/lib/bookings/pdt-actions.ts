"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { checkProjetAccess } from "@/lib/auth/session";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";
import { projetNomPublic } from "@/lib/projets/types";
import { formatDateLong } from "@/lib/format-date";
import { remplirModelePdt } from "./pdt";

// Modification du plan de travail : la journée « ancienne » est basculée vers
// la « nouvelle » date. Chaque profil y réapparaît en « À REBOOKER » (journée
// miroir) ; l'ancienne journée reste intacte jusqu'à ce que chacun·e soit
// traité·e sur la nouvelle date (voir le trigger finaliser_rebooking), puis
// on peut la supprimer. Les profils déjà calés à la nouvelle date et les
// autres journées ne sont pas touchés.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAQUET_IN = 150;

type BookingAncien = {
  id: string;
  figurant_id: string;
  statut: string;
  heure_convocation: string | null;
  fonction: string | null;
  cachet: string | null;
  notes: string | null;
  covoiturage_role: string | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
};

type Repartition = {
  aCreer: BookingAncien[];
  aDeplacer: BookingAncien[];
  dejaLa: BookingAncien[];
  dejaEnCours: BookingAncien[];
  annules: BookingAncien[];
  indispoIds: Set<string>;
};

async function repartir(projetId: string, ancienneDate: string, nouvelleDate: string): Promise<{ error?: string; r?: Repartition }> {
  const supabase = createAdminClient();
  const { data: anciens, error } = await fetchAll<BookingAncien>((from, to) =>
    supabase
      .from("bookings")
      .select(
        "id, figurant_id, statut, heure_convocation, fonction, cachet, notes, covoiturage_role, covoiturage_lieu_depart, covoiturage_places_disponibles"
      )
      .eq("projet_id", projetId)
      .eq("date", ancienneDate)
      .order("id")
      .range(from, to)
  );
  if (error) return { error: error.message };

  const figurantIds = Array.from(new Set(anciens.map((b) => b.figurant_id)));
  const ancienIds = anciens.map((b) => b.id);
  const dejaLaIds = new Set<string>();
  const indispoIds = new Set<string>();
  const avecMiroir = new Set<string>();
  for (let i = 0; i < Math.max(figurantIds.length, ancienIds.length); i += PAQUET_IN) {
    const figs = figurantIds.slice(i, i + PAQUET_IN);
    const ids = ancienIds.slice(i, i + PAQUET_IN);
    const [{ data: la }, { data: indispos }, { data: miroirs }] = await Promise.all([
      figs.length
        ? supabase.from("bookings").select("figurant_id").eq("projet_id", projetId).eq("date", nouvelleDate).in("figurant_id", figs)
        : Promise.resolve({ data: [] as { figurant_id: string }[] }),
      figs.length
        ? supabase.from("figurant_indisponibilites").select("figurant_id").eq("date", nouvelleDate).in("figurant_id", figs)
        : Promise.resolve({ data: [] as { figurant_id: string }[] }),
      ids.length
        ? supabase.from("bookings").select("rebook_depuis_booking_id").in("rebook_depuis_booking_id", ids)
        : Promise.resolve({ data: [] as { rebook_depuis_booking_id: string | null }[] }),
    ]);
    for (const b of la ?? []) dejaLaIds.add(b.figurant_id);
    for (const d of indispos ?? []) indispoIds.add(d.figurant_id);
    for (const m of miroirs ?? []) if (m.rebook_depuis_booking_id) avecMiroir.add(m.rebook_depuis_booking_id);
  }

  const r: Repartition = { aCreer: [], aDeplacer: [], dejaLa: [], dejaEnCours: [], annules: [], indispoIds };
  for (const b of anciens) {
    if (b.statut === "annulé") r.annules.push(b);
    else if (dejaLaIds.has(b.figurant_id)) r.dejaLa.push(b);
    else if (avecMiroir.has(b.id)) r.dejaEnCours.push(b);
    // Déjà « À REBOOKER » ici (modif précédente) : on le déplace simplement.
    else if (b.statut === "a_rebooker") r.aDeplacer.push(b);
    else r.aCreer.push(b);
  }
  return { r };
}

export type ApercuPdt = {
  aBasculer: number;
  dejaLa: number;
  dejaEnCours: number;
  annules: number;
  indispos: number;
  nouvelleExiste: boolean;
};

export async function apercuModificationPdt(
  projetId: string,
  ancienneDate: string,
  nouvelleDate: string
): Promise<{ error?: string; data?: ApercuPdt }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (!DATE_RE.test(nouvelleDate) || !DATE_RE.test(ancienneDate)) return { error: "Date invalide." };
  if (nouvelleDate === ancienneDate) return { error: "Choisis une autre date que la journée actuelle." };

  const { error, r } = await repartir(projetId, ancienneDate, nouvelleDate);
  if (error || !r) return { error: error ?? "Lecture impossible." };
  const { count } = await createAdminClient()
    .from("journees")
    .select("id", { count: "exact", head: true })
    .eq("projet_id", projetId)
    .eq("date", nouvelleDate);
  const basculees = [...r.aCreer, ...r.aDeplacer];
  return {
    data: {
      aBasculer: basculees.length,
      dejaLa: r.dejaLa.length,
      dejaEnCours: r.dejaEnCours.length,
      annules: r.annules.length,
      indispos: basculees.filter((b) => r.indispoIds.has(b.figurant_id)).length,
      nouvelleExiste: (count ?? 0) > 0,
    },
  };
}

export async function modifierPdt(
  projetId: string,
  ancienneDate: string,
  nouvelleDate: string,
  modeleMessage: string | null
): Promise<{ error?: string; basculees?: number; indispos?: number; dejaLa?: number; miroirIds?: string[] }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (!DATE_RE.test(nouvelleDate) || !DATE_RE.test(ancienneDate)) return { error: "Date invalide." };
  if (nouvelleDate === ancienneDate) return { error: "Choisis une autre date que la journée actuelle." };
  const supabase = createAdminClient();

  const { error: lectureError, r } = await repartir(projetId, ancienneDate, nouvelleDate);
  if (lectureError || !r) return { error: lectureError ?? "Lecture impossible." };

  // Nouvelle journée : si elle n'existe pas encore, elle reprend les infos de
  // l'ancienne (lieu, précisions de convocation, besoins).
  const { data: ancienneJournee } = await supabase
    .from("journees")
    .select("id, total_requis, lieu, convocation_precisions, convocation_hmc, convocation_accessoires, convocation_commentaires")
    .eq("projet_id", projetId)
    .eq("date", ancienneDate)
    .maybeSingle();
  const { data: existante } = await supabase
    .from("journees")
    .select("id")
    .eq("projet_id", projetId)
    .eq("date", nouvelleDate)
    .maybeSingle();
  if (!existante) {
    const infos = ancienneJournee
      ? {
          total_requis: ancienneJournee.total_requis,
          lieu: ancienneJournee.lieu,
          convocation_precisions: ancienneJournee.convocation_precisions,
          convocation_hmc: ancienneJournee.convocation_hmc,
          convocation_accessoires: ancienneJournee.convocation_accessoires,
          convocation_commentaires: ancienneJournee.convocation_commentaires,
        }
      : {};
    const { data: creee, error } = await supabase
      .from("journees")
      .insert({ projet_id: projetId, date: nouvelleDate, ...infos })
      .select("id")
      .single();
    if (error) return { error: error.message };
    if (ancienneJournee) {
      const { data: besoins } = await supabase.from("journee_besoins").select("fonction, quantite").eq("journee_id", ancienneJournee.id);
      if (besoins && besoins.length > 0) {
        await supabase.from("journee_besoins").insert(besoins.map((b) => ({ ...b, journee_id: creee.id })));
      }
    }
  }
  await supabase.from("journees").update({ pdt_vers: nouvelleDate }).eq("projet_id", projetId).eq("date", ancienneDate);
  // Bascules en chaîne (16 → 17 puis 17 → 18) : les journées d'origine
  // pointent désormais vers la nouvelle date.
  if (r.aDeplacer.length > 0) {
    await supabase.from("journees").update({ pdt_vers: nouvelleDate }).eq("projet_id", projetId).eq("pdt_vers", ancienneDate);
  }

  const miroirIds: string[] = [];
  for (let i = 0; i < r.aCreer.length; i += 500) {
    const paquet = r.aCreer.slice(i, i + 500);
    const { data: crees, error } = await supabase
      .from("bookings")
      .insert(
        paquet.map((b) => ({
          figurant_id: b.figurant_id,
          projet_id: projetId,
          date: nouvelleDate,
          heure_convocation: b.heure_convocation,
          fonction: b.fonction,
          cachet: b.cachet,
          notes: b.notes,
          covoiturage_role: b.covoiturage_role,
          covoiturage_lieu_depart: b.covoiturage_lieu_depart,
          covoiturage_places_disponibles: b.covoiturage_places_disponibles,
          statut: "a_rebooker",
          rebook_depuis_booking_id: b.id,
        }))
      )
      .select("id, rebook_depuis_booking_id");
    if (error) return { error: error.message };
    miroirIds.push(...(crees ?? []).map((c) => c.id));

    // Les indemnités (transport…) suivent la personne ; les majorations
    // dépendent du jour et sont à refaire.
    const miroirParAncien = new Map((crees ?? []).map((c) => [c.rebook_depuis_booking_id as string, c.id]));
    const { data: indemnites } = await supabase
      .from("booking_indemnites")
      .select("booking_id, projet_indemnite_id")
      .in("booking_id", paquet.map((b) => b.id));
    const copies = (indemnites ?? [])
      .filter((x) => miroirParAncien.has(x.booking_id))
      .map((x) => ({ booking_id: miroirParAncien.get(x.booking_id)!, projet_indemnite_id: x.projet_indemnite_id }));
    if (copies.length > 0) await supabase.from("booking_indemnites").insert(copies);
  }

  if (r.aDeplacer.length > 0) {
    const ids = r.aDeplacer.map((b) => b.id);
    for (let i = 0; i < ids.length; i += PAQUET_IN) {
      const { error } = await supabase
        .from("bookings")
        .update({ date: nouvelleDate, covoiturage_conducteur_id: null })
        .in("id", ids.slice(i, i + PAQUET_IN));
      if (error) return { error: error.message };
    }
    miroirIds.push(...ids);
  }

  if (modeleMessage !== null) {
    await supabase.from("projets").update({ modele_message_pdt: modeleMessage }).eq("id", projetId);
  }

  revalidatePath("/bookings");
  revalidatePath("/bookings/documents");
  revalidatePath("/bookings/planning");
  const basculees = [...r.aCreer, ...r.aDeplacer];
  return {
    basculees: basculees.length,
    indispos: basculees.filter((b) => r.indispoIds.has(b.figurant_id)).length,
    dejaLa: r.dejaLa.length,
    miroirIds,
  };
}

// Envoi du message aux profils basculés, par paquets (appelé en boucle par
// le client pour rester sous la durée max d'une fonction).
export async function prevenirProfilsPdt(
  projetId: string,
  ancienneDate: string,
  nouvelleDate: string,
  modele: string,
  bookingIds: string[],
  parEmail: boolean
): Promise<{ error?: string; envoyes: number; echecs: string[] }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError, envoyes: 0, echecs: [] };
  const supabase = createAdminClient();

  const [{ data: projet }, signature, { data: bookings }] = await Promise.all([
    supabase.from("projets").select("nom, confidentiel, nom_code").eq("id", projetId).single(),
    getProjetSignatureOrOwnerName(supabase, projetId),
    supabase
      .from("bookings")
      .select("id, figurant_id, figurants!bookings_figurant_id_fkey(prenom, nom, email)")
      .eq("projet_id", projetId)
      .in("id", bookingIds.slice(0, 50))
      .returns<{ id: string; figurant_id: string; figurants: { prenom: string; nom: string; email: string | null } | null }[]>(),
  ]);
  const nomProjet = projetNomPublic(projet);

  let envoyes = 0;
  const echecs: string[] = [];
  for (const b of bookings ?? []) {
    const corps = remplirModelePdt(modele, {
      prenom: b.figurants?.prenom ?? "",
      projet: nomProjet,
      ancienneDate: formatDateLong(ancienneDate),
      nouvelleDate: formatDateLong(nouvelleDate),
      signature,
    });
    const res = await recordFigurantMessage({
      figurantId: b.figurant_id,
      corps,
      categorie: "booking",
      bookingId: b.id,
      projetId,
      email: parEmail ? b.figurants?.email : null,
      subject: `${nomProjet} — changement de date de tournage`,
    });
    if (res.error) echecs.push(`${b.figurants?.prenom ?? ""} ${b.figurants?.nom ?? ""}`.trim() || "?");
    else envoyes += 1;
  }
  return { envoyes, echecs };
}

// Ancienne journée : une fois tout le monde traité sur la nouvelle date, on
// la supprime avec ce qui reste (profils déjà calés à la nouvelle date,
// annulé·es).
export async function supprimerJourneeBasculee(projetId: string, date: string): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();

  const { data: journee } = await supabase
    .from("journees")
    .select("id, pdt_vers")
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();
  if (!journee?.pdt_vers) return { error: "Cette journée n'a pas été basculée." };

  const { data: restants } = await fetchAll<{ id: string }>((from, to) =>
    supabase.from("bookings").select("id").eq("projet_id", projetId).eq("date", date).order("id").range(from, to)
  );
  const ids = restants.map((b) => b.id);
  for (let i = 0; i < ids.length; i += PAQUET_IN) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("rebook_depuis_booking_id", ids.slice(i, i + PAQUET_IN));
    if (count && count > 0) return { error: "Des profils sont encore « À REBOOKER » sur la nouvelle date." };
  }
  for (let i = 0; i < ids.length; i += PAQUET_IN) {
    const { error } = await supabase.from("bookings").delete().in("id", ids.slice(i, i + PAQUET_IN));
    if (error) return { error: error.message };
  }
  const { error } = await supabase.from("journees").delete().eq("id", journee.id);
  if (error) return { error: error.message };

  revalidatePath("/bookings");
  revalidatePath("/bookings/planning");
  return {};
}
