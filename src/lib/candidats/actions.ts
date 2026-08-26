"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/partage/data";
import { sendEmail } from "@/lib/email/send";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { getEmailTemplate, applyEmailTemplate } from "@/lib/projets/email-templates";
import { LIEN_BANDE_DEMO, LIEN_INSTAGRAM, MAX_PHOTOS_PAR_FIGURANT, type PhotoType } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { countFigurantPhotos, insertFigurantPhoto } from "@/lib/figurants/photos";
import { clearFigurantSessionCookie, getCurrentFigurant } from "./session";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function genToken() {
  return randomUUID().replace(/-/g, "");
}

async function createMagicLinkToken(figurantId: string) {
  const supabase = createAdminClient();
  const token = genToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error } = await supabase
    .from("figurant_auth_tokens")
    .insert({ figurant_id: figurantId, token, expires_at: expiresAt.toISOString() });
  if (error) return { error: "Une erreur est survenue, réessayez." };

  const origin = await getSiteOrigin();
  return { link: `${origin}/compte/verifier?token=${token}` };
}

// Envoi réel (Gmail SMTP) du lien de connexion — utilisé pour une demande
// volontaire du candidat déjà actif (/compte/connexion). projetId absent
// (demande publique, sans contexte cheffe) => boîte partagée par défaut.
export async function sendMagicLinkEmail(
  figurant: { id: string; prenom: string; email: string },
  projetId?: string | null
) {
  const { link, error: linkError } = await createMagicLinkToken(figurant.id);
  if (linkError || !link) return { error: linkError };

  const supabaseForTemplate = createAdminClient();
  const customTemplate = await getEmailTemplate(supabaseForTemplate, projetId, "magic_link");

  const subject = "Booking Extras — votre lien de connexion";
  const body = customTemplate
    ? applyEmailTemplate(customTemplate, { prenom: figurant.prenom, lien: link })
    : [
        `Bonjour ${figurant.prenom},`,
        "",
        "Voici votre lien de connexion à votre espace Booking Extras (valable 30 minutes) :",
        link,
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      ].join("\n");

  const { credentials, error: credError } = await getProjetEmailCredentials(createAdminClient(), projetId);
  if (credError) return { error: credError };
  const result = await sendEmail(figurant.email, subject, body, credentials);
  if (result.error) return { error: result.error };
  return { success: true as const };
}

// Envoyé une seule fois, au moment où l'accès à l'espace personnel s'active
// (candidature passée à "retenu", ou activation manuelle par le staff) —
// texte différent du simple renvoi de lien : explique le statut "retenu"
// et à quoi sert l'espace.
export async function sendAccesCompteActiveEmail(
  figurant: { id: string; prenom: string; email: string },
  projetId?: string | null
) {
  const { link, error: linkError } = await createMagicLinkToken(figurant.id);
  if (linkError || !link) return { error: linkError };

  const supabaseForTemplate = createAdminClient();
  const customTemplate = await getEmailTemplate(supabaseForTemplate, projetId, "espace_perso");

  const subject = "Booking Extras — votre espace personnel est prêt";
  const body = customTemplate
    ? applyEmailTemplate(customTemplate, { prenom: figurant.prenom, lien: link })
    : [
        `Bonjour ${figurant.prenom},`,
        "",
        "Vous avez été ajouté·e à une date de tournage.",
        "",
        "Merci d'accéder à votre espace personnel : vous y retrouverez vos dates et les échanges de messages avec nous.",
        "",
        `Voici votre lien de connexion (valable 30 minutes) :`,
        link,
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      ].join("\n");

  const { credentials, error: credError } = await getProjetEmailCredentials(createAdminClient(), projetId);
  if (credError) return { error: credError };
  const result = await sendEmail(figurant.email, subject, body, credentials);
  if (result.error) return { error: result.error };
  return { success: true as const };
}

export async function requestMagicLink(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; sentTo?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Merci de renseigner votre email." };

  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, email, acces_compte")
    .ilike("email", email)
    .maybeSingle();

  if (!figurant?.email) {
    return { error: "Aucun compte ne correspond à cet email. Vérifiez votre saisie ou contactez le casting." };
  }
  if (!figurant.acces_compte) {
    return {
      error:
        "Votre espace n'est pas encore activé. Il s'active dès que votre candidature est validée — vous recevrez un email à ce moment-là.",
    };
  }

  const result = await sendMagicLinkEmail(figurant);
  if (result.error) return { error: result.error };

  return { sentTo: figurant.email };
}

export async function logoutFigurant() {
  await clearFigurantSessionCookie();
  redirect("/compte/connexion");
}

export async function markMessageBienRecu(messageId: string) {
  const figurant = await getCurrentFigurant();
  if (!figurant) return { error: "Non connecté." };

  const supabase = createAdminClient();
  const { data: message, error } = await supabase
    .from("figurant_messages")
    .update({ bien_recu: true })
    .eq("id", messageId)
    .eq("figurant_id", figurant.id)
    .eq("sender", "staff")
    .select("booking_id")
    .single();

  if (error) return { error: error.message };

  if (message?.booking_id) {
    await supabase
      .from("bookings")
      .update({ reponse_recue: true, reponse_recue_le: new Date().toISOString() })
      .eq("id", message.booking_id);
    revalidatePath("/bookings/documents");
  }

  revalidatePath("/compte");
  return { success: true };
}

export async function subscribeToPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const figurant = await getCurrentFigurant();
  if (!figurant) return { error: "Non connecté." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      figurant_id: figurant.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function unsubscribeFromPush(endpoint: string) {
  const figurant = await getCurrentFigurant();
  if (!figurant) return { error: "Non connecté." };

  const supabase = createAdminClient();
  await supabase.from("push_subscriptions").delete().eq("figurant_id", figurant.id).eq("endpoint", endpoint);
  return { success: true };
}


// Débloque l'accès à /compte pour ce figurant. Le mail "espace prêt" ne
// repart qu'une fois PAR PROJET (tracé via figurant_messages, catégorie
// espace_perso) — sinon un figurant déjà actif sur un tournage passé ne
// serait jamais prévenu d'un nouveau booking confirmé sur un autre projet.
// Sans projetId (bascule manuelle depuis la fiche figurant), on retombe sur
// l'ancien comportement : idempotent une seule fois pour toute la vie du
// profil.
export async function activerAccesCompte(figurantId: string, projetId?: string | null) {
  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, email, acces_compte")
    .eq("id", figurantId)
    .single();

  if (!figurant) return { success: true as const };

  const etaitDejaActif = figurant.acces_compte;
  if (!etaitDejaActif) {
    await supabase.from("figurants").update({ acces_compte: true }).eq("id", figurantId);
  }

  if (projetId) {
    const { data: dejaEnvoye } = await supabase
      .from("figurant_messages")
      .select("id")
      .eq("figurant_id", figurantId)
      .eq("projet_id", projetId)
      .eq("categorie", "espace_perso")
      .maybeSingle();
    if (dejaEnvoye) {
      revalidatePath(`/figurants/${figurantId}`);
      return { success: true as const };
    }
  } else if (etaitDejaActif) {
    revalidatePath(`/figurants/${figurantId}`);
    return { success: true as const };
  }

  if (figurant.email) {
    const result = await sendAccesCompteActiveEmail(
      { id: figurant.id, prenom: figurant.prenom, email: figurant.email },
      projetId
    );
    if (result.error) {
      revalidatePath(`/figurants/${figurantId}`);
      return { error: result.error };
    }
  }

  await supabase.from("figurant_messages").insert({
    figurant_id: figurantId,
    projet_id: projetId ?? null,
    sender: "staff",
    corps: "Lien d'accès à l'espace personnel envoyé.",
    categorie: "espace_perso",
  });

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

// Bascule manuelle depuis la fiche figurant (accorder ou révoquer), pour les
// cas hors du flux candidature normal. projetId = projet actuellement
// sélectionné (bandeau du haut), pour que l'envoi respecte la même boîte
// Gmail (et la même obligation de config pour les cheffes non-admin) que le
// reste de la messagerie sur cette fiche partagée.
export async function toggleAccesCompte(figurantId: string, value: boolean, projetId?: string | null) {
  const supabase = createAdminClient();
  if (value) return activerAccesCompte(figurantId, projetId);

  await supabase.from("figurants").update({ acces_compte: false }).eq("id", figurantId);
  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildVehiculePayload(fd: FormData) {
  const aVehicule = str(fd, "a_vehicule");
  return {
    a_vehicule: aVehicule === null ? null : aVehicule === "oui",
    vehicule_velo: fd.get("vehicule_velo") === "on",
    vehicule_moto: fd.get("vehicule_moto") === "on",
    vehicule_scooter: fd.get("vehicule_scooter") === "on",
    vehicule_marque: str(fd, "vehicule_marque"),
  };
}

// Le candidat ne modifie que sa PROPRE fiche — l'id vient de sa session,
// jamais d'un champ du formulaire, pour ne jamais pouvoir modifier un autre
// profil.
export async function updateMaFiche(_prevState: unknown, formData: FormData) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const email = str(formData, "email");
  const telephone = str(formData, "telephone");
  const ville = str(formData, "ville");
  const adresse = str(formData, "adresse");
  const codePostal = str(formData, "code_postal");
  const communeNaissance = str(formData, "commune_naissance");
  const genre = str(formData, "genre");
  const pronom = str(formData, "pronom");
  if (!email || !telephone) {
    return { error: "Email et téléphone sont obligatoires." };
  }
  if (!adresse || !codePostal || !ville) {
    return { error: "L'adresse de résidence complète (rue, code postal, ville) est obligatoire." };
  }
  if (!communeNaissance) {
    return { error: "La commune de naissance est obligatoire." };
  }
  if (!genre || !pronom) {
    return { error: "Le genre et le pronom sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurants")
    .update({
      email,
      telephone,
      ville,
      adresse,
      code_postal: codePostal,
      commune_naissance: communeNaissance,
      date_naissance: str(formData, "date_naissance"),
      genre,
      pronom,
      taille_cm: num(formData, "taille_cm"),
      poids_kg: num(formData, "poids_kg"),
      pointure: num(formData, "pointure"),
      veste: str(formData, "veste"),
      pantalon: str(formData, "pantalon"),
      tour_tete_cm: num(formData, "tour_tete_cm"),
      tour_cou_cm: num(formData, "tour_cou_cm"),
      tour_poitrine_cm: num(formData, "tour_poitrine_cm"),
      tour_taille_cm: num(formData, "tour_taille_cm"),
      tour_hanches_cm: num(formData, "tour_hanches_cm"),
      jambes_ext_cm: num(formData, "jambes_ext_cm"),
      jambes_int_cm: num(formData, "jambes_int_cm"),
      gant: str(formData, "gant"),
      carrure_cm: num(formData, "carrure_cm"),
      couleur_yeux: str(formData, "couleur_yeux"),
      couleur_cheveux: str(formData, "couleur_cheveux"),
      ...buildVehiculePayload(formData),
    })
    .eq("id", session.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Un autre profil existe déjà avec cet email." };
    }
    return { error: error.message };
  }

  await Promise.all([
    upsertFigurantLienByLabel(supabase, session.id, LIEN_BANDE_DEMO, str(formData, "lien_bande_demo")),
    upsertFigurantLienByLabel(supabase, session.id, LIEN_INSTAGRAM, str(formData, "lien_instagram")),
  ]);

  revalidatePath("/compte");
  return { success: true as const };
}

export async function addIndisponibiliteSelf(_prevState: unknown, formData: FormData) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const date = str(formData, "date");
  if (!date) return { error: "Merci de choisir une date." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurant_indisponibilites")
    .upsert(
      { figurant_id: session.id, date, motif: str(formData, "motif") },
      { onConflict: "figurant_id,date" }
    );

  if (error) return { error: error.message };

  revalidatePath("/compte");
  return { success: true as const };
}

export async function removeIndisponibiliteSelf(date: string) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const supabase = createAdminClient();
  await supabase
    .from("figurant_indisponibilites")
    .delete()
    .eq("figurant_id", session.id)
    .eq("date", date);

  revalidatePath("/compte");
  return { success: true as const };
}

// Le candidat ne gère que ses PROPRES photos — l'id vient de sa session,
// jamais d'un champ du formulaire.
export async function uploadMaPhoto(_prevState: unknown, formData: FormData) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const file = formData.get("photo");
  const type = (str(formData, "type") as PhotoType | null) ?? "autre";
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisis une photo." };
  }

  const supabase = createAdminClient();
  const existing = await countFigurantPhotos(supabase, session.id);
  if (existing >= MAX_PHOTOS_PAR_FIGURANT) {
    return { error: `Maximum ${MAX_PHOTOS_PAR_FIGURANT} photos.` };
  }

  const priseLe = type === "selfie" ? new Date().toISOString().slice(0, 10) : null;
  const result = await insertFigurantPhoto(supabase, session.id, type, file, { priseLe });
  if (result.error) return { error: result.error };

  revalidatePath("/compte");
  return { success: true as const };
}

export async function deleteMaPhoto(photoId: string) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("figurant_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("figurant_id", session.id)
    .maybeSingle();
  if (!photo) return { error: "Photo introuvable." };

  await supabase.storage.from("figurant-photos").remove([photo.storage_path]);
  await supabase.from("figurant_photos").delete().eq("id", photoId);

  revalidatePath("/compte");
  return { success: true as const };
}
