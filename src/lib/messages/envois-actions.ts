"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { recordFigurantMessage } from "@/lib/candidats/messaging";

async function projetDeLEnvoi(envoiId: string) {
  const { data } = await createAdminClient().from("envois").select("projet_id").eq("id", envoiId).maybeSingle();
  return data?.projet_id ?? null;
}

// Crée l'envoi (nommé) et ses destinataires ; renvoie le lien « Bien reçu »
// de chacun pour personnaliser les messages avant l'envoi.
export async function creerEnvoi(params: {
  projetId: string;
  date: string;
  titre: string;
  sujet: string;
  corps: string;
  canal: "email" | "texto";
  avecAccuse: boolean;
  destinataires: { figurantId: string; bookingId: string | null }[];
}): Promise<{ error?: string; envoiId?: string; tokens?: Record<string, { id: string; token: string }> }> {
  const accessError = await checkProjetAccess(params.projetId);
  if (accessError) return { error: accessError };
  const titre = params.titre.trim();
  if (!titre) return { error: "Donne un nom à ce message (ex. Parking, Horaire avancé)." };
  if (!params.corps.trim()) return { error: "Le message est vide." };
  if (params.destinataires.length === 0) return { error: "Aucun destinataire." };

  const profile = await getCurrentProfile();
  const supabase = createAdminClient();
  const { data: envoi, error } = await supabase
    .from("envois")
    .insert({
      projet_id: params.projetId,
      date: params.date,
      titre: titre.slice(0, 80),
      sujet: params.sujet,
      corps: params.corps,
      canal: params.canal,
      avec_accuse: params.avecAccuse,
      created_by: profile?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !envoi) return { error: "Envoi impossible à créer, réessaie." };

  const { data: lignes, error: errLignes } = await supabase
    .from("envoi_destinataires")
    .insert(params.destinataires.map((d) => ({ envoi_id: envoi.id, figurant_id: d.figurantId, booking_id: d.bookingId })))
    .select("id, figurant_id, token");
  if (errLignes) {
    await supabase.from("envois").delete().eq("id", envoi.id);
    return { error: "Destinataires impossibles à enregistrer, réessaie." };
  }

  return {
    envoiId: envoi.id,
    tokens: Object.fromEntries((lignes ?? []).map((l) => [l.figurant_id, { id: l.id, token: l.token }])),
  };
}

// Envoie (ou relance) par email un paquet de destinataires d'un envoi,
// chacun avec son texte personnalisé ; trace dans l'historique du profil.
export async function envoyerEnvoiEmail(
  envoiId: string,
  items: { destinataireId: string; figurantId: string; bookingId: string | null; email: string | null; sujet: string; corps: string }[],
  relance = false
): Promise<{ error?: string; envoyes: number; echecs: number }> {
  const projetId = await projetDeLEnvoi(envoiId);
  if (!projetId) return { error: "Envoi introuvable.", envoyes: 0, echecs: 0 };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError, envoyes: 0, echecs: 0 };

  const supabase = createAdminClient();
  let envoyes = 0;
  let echecs = 0;
  for (const it of items) {
    if (!it.email) {
      await supabase.from("envoi_destinataires").update({ erreur: "Pas d'email" }).eq("id", it.destinataireId).eq("envoi_id", envoiId);
      echecs += 1;
      continue;
    }
    const res = await recordFigurantMessage({
      figurantId: it.figurantId,
      corps: it.corps,
      categorie: "libre",
      email: it.email,
      subject: it.sujet,
      projetId,
      bookingId: it.bookingId,
    });
    const maintenant = new Date().toISOString();
    if (res.error) {
      echecs += 1;
      await supabase.from("envoi_destinataires").update({ erreur: res.error }).eq("id", it.destinataireId).eq("envoi_id", envoiId);
      continue;
    }
    envoyes += 1;
    if (relance) {
      const { data: ligne } = await supabase.from("envoi_destinataires").select("relances").eq("id", it.destinataireId).maybeSingle();
      await supabase
        .from("envoi_destinataires")
        .update({ relances: (ligne?.relances ?? 0) + 1, derniere_relance_le: maintenant, erreur: null })
        .eq("id", it.destinataireId)
        .eq("envoi_id", envoiId);
    } else {
      await supabase
        .from("envoi_destinataires")
        .update({ envoye_le: maintenant, erreur: null })
        .eq("id", it.destinataireId)
        .eq("envoi_id", envoiId);
    }
  }
  revalidatePath("/bookings/documents");
  return { envoyes, echecs };
}

// Textos : mis en file (relais Mac) ou partis depuis l'iPhone — on note la
// date d'envoi (ou la relance) des destinataires concernés.
export async function marquerEnvoiTextos(
  envoiId: string,
  destinataireIds: string[],
  relance = false
): Promise<{ error?: string }> {
  const projetId = await projetDeLEnvoi(envoiId);
  if (!projetId) return { error: "Envoi introuvable." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();
  const maintenant = new Date().toISOString();
  if (relance) {
    const { data: lignes } = await supabase.from("envoi_destinataires").select("id, relances").in("id", destinataireIds).eq("envoi_id", envoiId);
    for (const l of lignes ?? []) {
      await supabase.from("envoi_destinataires").update({ relances: l.relances + 1, derniere_relance_le: maintenant }).eq("id", l.id);
    }
  } else {
    await supabase.from("envoi_destinataires").update({ envoye_le: maintenant, erreur: null }).in("id", destinataireIds).eq("envoi_id", envoiId);
  }
  revalidatePath("/bookings/documents");
  return {};
}

// Réception confirmée à la main (ex. la personne a répondu par téléphone),
// ou annulée.
export async function marquerRecu(destinataireId: string, recu: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { data: ligne } = await supabase.from("envoi_destinataires").select("envoi_id").eq("id", destinataireId).maybeSingle();
  if (!ligne) return { error: "Introuvable." };
  const projetId = await projetDeLEnvoi(ligne.envoi_id);
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  await supabase
    .from("envoi_destinataires")
    .update({ accuse_le: recu ? new Date().toISOString() : null })
    .eq("id", destinataireId);
  revalidatePath("/bookings/documents");
  return {};
}

export async function supprimerEnvoi(envoiId: string): Promise<{ error?: string }> {
  const projetId = await projetDeLEnvoi(envoiId);
  if (!projetId) return { error: "Envoi introuvable." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  await createAdminClient().from("envois").delete().eq("id", envoiId);
  revalidatePath("/bookings/documents");
  return {};
}

// Page publique /recu/<token> : la personne confirme avoir bien reçu le
// message (un clic, sans compte).
export async function confirmerReception(token: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "Lien invalide." };
  const supabase = createAdminClient();
  const { data: ligne, error: lookupError } = await supabase.from("envoi_destinataires").select("id, accuse_le").eq("token", token).maybeSingle();
  if (lookupError) return { error: "Impossible de vérifier le lien. Réessaie." };
  if (!ligne) return { error: "Lien invalide ou expiré." };
  if (!ligne.accuse_le) {
    const { error } = await supabase.from("envoi_destinataires").update({ accuse_le: new Date().toISOString() }).eq("id", ligne.id);
    if (error) return { error: "Impossible d’enregistrer la confirmation. Réessaie." };
  }
  return {};
}
