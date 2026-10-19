"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { envoyerInvitationCompte } from "@/lib/candidats/invitation";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultatAjoutRapide = {
  error?: string;
  nom?: string;
  // Fiche déjà dans la base (même email, ou même nom + même téléphone).
  existant?: boolean;
  // Ce qu'il s'est passé côté mail « Crée ton compte ».
  mail?: "envoye" | "compte_existant" | "pas_email" | "erreur";
  mailErreur?: string;
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
  if (!prenom || !nom) return { error: "Prénom et nom obligatoires." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (!email && !telephone) return { error: "Indique au moins un email ou un téléphone." };

  const supabase = createAdminClient();

  // Fiche déjà dans la base : même email, sinon même nom + même téléphone
  // (fiches comédien·nes exclues, privées à leur pool).
  let figurantId: string | null = null;
  if (email) {
    const { data } = await supabase
      .from("figurants")
      .select("id")
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
      .eq("est_comedien", false)
      .limit(1)
      .maybeSingle();
    figurantId = data?.id ?? null;
  }
  if (!figurantId && telephone) {
    const tel = telephone.replace(/\s+/g, "");
    const { data } = await supabase
      .from("figurants")
      .select("id, telephone")
      .ilike("nom", nom.replace(/[\\%_]/g, "\\$&"))
      .eq("est_comedien", false);
    figurantId = (data ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === tel)?.id ?? null;
  }
  const existant = !!figurantId;

  if (figurantId) {
    const { data: deja } = await supabase
      .from("bookings")
      .select("id")
      .eq("figurant_id", figurantId)
      .eq("projet_id", projetId)
      .eq("date", date)
      .maybeSingle();
    if (deja) return { error: `${prenom} ${nom} est déjà dans cette journée.` };
  } else {
    const { data: creee, error } = await supabase
      .from("figurants")
      .insert({
        prenom,
        nom,
        email: email || null,
        telephone: telephone || null,
        confirme: true,
        acces_compte: false,
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

  await supabase.from("journees").upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });
  const { error: bookingError } = await supabase.from("bookings").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    date,
    fonction: fonction.trim(),
    cachet,
  });
  if (bookingError) return { error: bookingError.message };
  if (existant) await supabase.from("figurants").update({ confirme: true }).eq("id", figurantId);

  const invitation = await envoyerInvitationCompte(figurantId!, projetId);
  const mail: ResultatAjoutRapide["mail"] =
    invitation === "envoyee" || invitation === "deja_envoyee"
      ? "envoye"
      : invitation === "compte_existant" || invitation === "pas_email"
        ? invitation
        : "erreur";

  revalidatePath("/bookings/documents");
  revalidatePath("/bookings/planning");
  revalidatePath("/figurants");
  return {
    nom: `${prenom} ${nom}`,
    existant,
    mail,
    mailErreur: typeof invitation === "object" ? invitation.erreur : undefined,
  };
}
