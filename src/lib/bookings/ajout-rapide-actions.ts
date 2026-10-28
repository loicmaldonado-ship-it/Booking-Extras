"use server";

import { ageOnDate } from "@/lib/minors/model";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkProjetAccess } from "@/lib/auth/session";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { envoyerInvitationCompte } from "@/lib/candidats/invitation";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { doublonsProbables, type DoublonProbable } from "@/lib/figurants/doublons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultatAjoutRapide = {
  error?: string;
  nom?: string;
  // Fiche déjà dans la base (même email, ou même nom + même téléphone).
  existant?: boolean;
  // Ce qu'il s'est passé côté mail « Crée ton compte ».
  mail?: "envoye" | "compte_existant" | "pas_email" | "erreur";
  mailErreur?: string;
  // Rien n'a été créé : des fiches ressemblent à cette personne, à
  // l'équipe de choisir (reprendre l'une d'elles, ou nouvelle fiche).
  doublons?: (DoublonProbable & { dejaDansJournee: boolean })[];
};

// Ajout rapide dans une journée de Bookings : photo, prénom, nom, email,
// téléphone. La fiche va dans la Base Profils, sans compte ; un mail lui
// propose de créer son compte (obligatoire pour postuler ensuite). Une
// fiche déjà connue est reprise, jamais dupliquée.
export async function ajoutRapideBooking(
  projetId: string,
  date: string,
  fonction: string,
  cachet: Cachet | "",
  formData: FormData
): Promise<ResultatAjoutRapide> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  // Journée de booking : fonction et cachet obligatoires.
  if (!fonction.trim()) return { error: "Choisis une fonction." };
  if (!cachet || !CACHETS.includes(cachet)) return { error: "Choisis un cachet." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };

  const champ = (k: string) => String(formData.get(k) ?? "").trim();
  const prenom = champ("prenom");
  const nom = champ("nom");
  const email = champ("email").toLowerCase();
  const telephone = champ("telephone");
  const photo = formData.get("photo");
  const birth = champ("date_naissance");
  if (!prenom || !nom) return { error: "Prénom et nom obligatoires." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (!email && !telephone) return { error: "Indique au moins un email ou un téléphone." };

  const supabase = createAdminClient();
  // A project membership does not grant access to every private person.
  const visible = await createServerSupabaseClient();

  // Fiche déjà dans la base : même email, sinon même nom + même téléphone
  // (fiches comédien·nes exclues, privées à leur pool).
  let figurantId: string | null = null;
  if (email) {
    const { data, error: emailError } = await visible
      .from("figurants")
      .select("id")
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .eq("est_comedien", false)
      .limit(1)
      .maybeSingle();
    if (emailError) return { error: "Impossible de vérifier les profils existants. Réessaie." };
    figurantId = data?.id ?? null;
  }
  if (!figurantId && telephone) {
    const tel = telephone.replace(/\s+/g, "");
    const { data, error: telephoneError } = await visible
      .from("figurants")
      .select("id, telephone")
      .ilike("nom", nom.replace(/[\\%_]/g, "\\$&"))
      .eq("est_comedien", false);
    if (telephoneError) return { error: "Impossible de vérifier les profils existants. Réessaie." };
    figurantId = (data ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === tel)?.id ?? null;
  }

  // Ressemblances moins sûres (accents, une lettre, téléphone écrit
  // autrement) : on demande avant de créer. choix = « reprendre:<id> » ou
  // « nouvelle », renvoyé par le formulaire après la question.
  const choix = champ("choix");
  if (!figurantId && choix.startsWith("reprendre:")) {
    const { data } = await visible
      .from("figurants")
      .select("id")
      .eq("id", choix.slice("reprendre:".length))
      .eq("est_comedien", false)
      .maybeSingle();
    if (!data) return { error: "Fiche introuvable." };
    figurantId = data.id;
  } else if (!figurantId && choix !== "nouvelle") {
    let doublons: DoublonProbable[];
    try {
      doublons = await doublonsProbables({ prenom, nom, telephone });
    } catch {
      return { error: "Impossible de vérifier les doublons. Réessaie." };
    }
    if (doublons.length > 0) {
      const { data: deja } = await supabase
        .from("bookings")
        .select("figurant_id")
        .eq("projet_id", projetId)
        .eq("date", date)
        .in("figurant_id", doublons.map((d) => d.id));
      const dansJournee = new Set((deja ?? []).map((b) => b.figurant_id));
      return { doublons: doublons.map((d) => ({ ...d, dejaDansJournee: dansJournee.has(d.id) })) };
    }
  }
  const existant = !!figurantId;
  let nomAffiche = `${prenom} ${nom}`;

  if (figurantId) {
    const { data: deja, error: dejaError } = await supabase
      .from("bookings")
      .select("id")
      .eq("figurant_id", figurantId)
      .eq("projet_id", projetId)
      .eq("date", date)
      .maybeSingle();
    if (dejaError) return { error: "Impossible de vérifier les bookings existants. Réessaie." };
    if (deja) return { error: "Cette personne est déjà dans cette journée." };
    // Fiche reprise : on complète l'email / le téléphone s'ils manquaient.
    const { data: fiche } = await visible
      .from("figurants")
      .select("prenom, nom, email, telephone, date_naissance")
      .eq("id", figurantId)
      .single();
    if (!fiche?.date_naissance || ageOnDate(fiche.date_naissance, date) === null) return { error: "Complète une date de naissance valide dans la fiche profil avant le booking." };
    if (fiche) nomAffiche = `${fiche.prenom} ${fiche.nom}`;
    const complement = {
      ...(email && !fiche?.email ? { email } : {}),
      ...(telephone && !fiche?.telephone ? { telephone } : {}),
    };
    if (Object.keys(complement).length > 0) {
      const { error } = await supabase.from("figurants").update(complement).eq("id", figurantId);
      if (error) console.error("[ajoutRapideBooking] complément de fiche :", error.message);
    }
  } else {
    const age = ageOnDate(birth, date);
    if (age === null) return { error: "Renseigne une date de naissance valide pour ce nouveau profil." };
    if (age < 18) return { error: "Pour un mineur, crée d’abord sa fiche et complète son dossier dans Mineurs avant de l’ajouter au booking." };
    const { data: creee, error } = await supabase
      .from("figurants")
      .insert({
        prenom,
        nom,
        date_naissance: birth,
        email: email || null,
        telephone: telephone || null,
        confirme: true,
        acces_compte: false,
        temporaire: true,
        temporaire_projet_id: projetId,
      })
      .select("id")
      .single();
    if (error || !creee) {
      if (error?.code === "23505") return { error: "Cet email est déjà utilisé par une autre fiche." };
      return { error: error?.message ?? "Création du profil impossible." };
    }
    figurantId = creee.id;
    if (photo instanceof File && photo.size > 0) {
      const res = await insertFigurantPhoto(supabase, creee.id, "portrait", photo);
      if (res.error) console.error("[ajoutRapideBooking] photo :", res.error);
    }
  }

  const { error: journeeError } = await supabase.from("journees").upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });
  if (journeeError) {
    if (!existant) {
      revalidatePath("/figurants");
      return { error: "La fiche a été créée, mais la journée n’a pas pu être préparée. Retrouve cette fiche avant de réessayer." };
    }
    return { error: "Impossible de préparer la journée de booking. Réessaie." };
  }
  const { error: bookingError } = await supabase.from("bookings").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    date,
    fonction: fonction.trim(),
    cachet,
  });
  if (bookingError) {
    if (!existant) {
      revalidatePath("/figurants");
      return { error: "La fiche a été créée, mais le booking a échoué. Retrouve cette fiche avant de réessayer." };
    }
    return { error: "Impossible de créer le booking. Réessaie." };
  }
  if (existant) {
    const { error: profilError } = await supabase.from("figurants").update({ confirme: true }).eq("id", figurantId);
    if (profilError) {
      revalidatePath("/bookings/documents");
      revalidatePath("/bookings/planning");
      revalidatePath("/figurants");
      return { error: "Le booking a été créé, mais le profil n’a pas pu être mis à jour. Vérifie le booking existant avant de réessayer." };
    }
  }

  const invitation = await envoyerInvitationCompte(figurantId!, projetId);
  const mail: ResultatAjoutRapide["mail"] =
    invitation === "envoyee" || invitation === "deja_envoyee" || (typeof invitation === "object" && invitation.emailEnvoye)
      ? "envoye"
      : invitation === "compte_existant" || invitation === "pas_email"
        ? invitation
        : "erreur";

  revalidatePath("/bookings/documents");
  revalidatePath("/bookings/planning");
  revalidatePath("/figurants");
  return {
    nom: nomAffiche,
    existant,
    mail,
    mailErreur: typeof invitation === "object" ? invitation.erreur : undefined,
  };
}
