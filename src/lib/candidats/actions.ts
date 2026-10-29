"use server";

import { readGuardians } from "@/lib/minors/model";
import { aAccesComplet } from "@/lib/auth/owner";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { retourAutorise } from "@/lib/candidats/retour";
import { aCreeSonCompte, definirMotDePasse, motDePasseCorrect } from "@/lib/candidats/mot-de-passe";
import { invitationPourFicheSansCompte } from "@/lib/candidats/invitation";
import { LIEN_BANDE_DEMO, LIEN_INSTAGRAM, MAX_PHOTOS_PAR_FIGURANT, type PhotoType } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { countFigurantPhotos, insertFigurantPhoto } from "@/lib/figurants/photos";
import { clearFigurantSessionCookie, createFigurantSession, getCurrentFigurant, setFigurantSessionCookie } from "./session";
import { getCurrentProfile, checkProjetAccess } from "@/lib/auth/session";
import { consumeCandidateLoginAttempt } from "@/lib/candidats/rate-limit";
import { MOT_DE_PASSE_MIN } from "@/lib/candidats/profil";
import { sendMagicLinkEmail, sendAccesCompteActiveEmail } from "@/lib/candidats/email";

export async function requestMagicLink(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; sentTo?: string; invitationEnvoyee?: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Merci de renseigner votre email." };

  // BUG-09: never disclose whether an address exists, is disabled, or whether
  // SMTP is currently configured. Apply a shared rate limit before lookup.
  const permitted = await consumeCandidateLoginAttempt(email);
  if (!permitted) return { sentTo: email };
  const supabase = createAdminClient();
  const { data: figurant, error: lookupError } = await supabase
    .from("figurants")
    .select("id, prenom, email, acces_compte")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .eq("est_comedien", false)
    .maybeSingle();

  if (!lookupError && figurant?.email) {
    if (figurant.acces_compte) {
      const result = await sendMagicLinkEmail(figurant, null, retourAutorise(formData.get("retour")));
      if (result.error) console.error("Échec de l'envoi du lien de connexion candidat.");
    } else {
      // Invitation possible, sans révéler au demandeur si cette fiche existe.
      try { await invitationPourFicheSansCompte(figurant.id, null, retourAutorise(formData.get("retour"))); }
      catch { console.error("Échec de l'invitation au compte candidat."); }
    }
  }
  return { sentTo: email };
}

// Alternative au lien magique quand un mot de passe a déjà été défini
// (setMaPassword ci-dessous) — même filtre est_comedien que requestMagicLink,
// mêmes raisons.
export async function loginWithPassword(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || email.length > 254 || password.length > 1024) return { error: "Email ou mot de passe incorrect." };
  if (!(await consumeCandidateLoginAttempt(email))) {
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, acces_compte")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .eq("est_comedien", false)
    .maybeSingle();

  const correct = await motDePasseCorrect(figurant?.id ?? "00000000-0000-0000-0000-000000000000", password);
  if (!figurant?.acces_compte || !correct) {
    return { error: "Email ou mot de passe incorrect." };
  }

  await createFigurantSession(figurant.id);
  redirect(retourAutorise(formData.get("retour")) ?? "/compte");
}

// Appelée depuis l'espace personnel (déjà connecté·e) — que ce soit juste
// après avoir postulé (session posée par postulerAnnonce) ou plus tard
// depuis /compte, pour définir ou changer son mot de passe. Jamais
// obligatoire : le lien magique reste toujours disponible sans lui.
export async function setMaPassword(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const password = String(formData.get("password") ?? "");
  if (password.length < MOT_DE_PASSE_MIN) {
    return { error: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.` };
  }

  const { error, session: renewed } = await definirMotDePasse(session.id, password, true, (await cookies()).get("figurant_session")?.value);
  if (error) return { error };
  if (!renewed) return { error: "Session non créée. Reconnecte-toi." };
  // Nouvelle session créée sous le même verrou que la révocation des anciennes.
  await setFigurantSessionCookie(renewed.token, new Date(renewed.expiresAt));
  return { success: true };
}

export async function logoutFigurant() {
  // Destroy the server-side session as well as the browser cookie.
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get("figurant_session")?.value;
  if (token) {
    const { error } = await createAdminClient().from("figurant_sessions").delete().eq("token", token);
    if (error) throw new Error("Impossible de révoquer la session candidat.");
  }
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
    // The message is authenticated, but its booking reference is still
    // untrusted. Never mutate another candidate's booking via service_role.
    const { data: updatedBooking, error: bookingError } = await supabase
      .from("bookings")
      .update({ reponse_recue: true, reponse_recue_le: new Date().toISOString() })
      .eq("id", message.booking_id)
      .eq("figurant_id", figurant.id)
      .select("id")
      .maybeSingle();
    if (bookingError || !updatedBooking) return { error: "Message reçu, mais mise à jour du booking impossible." };
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
  const { error } = await supabase.from("push_subscriptions").delete().eq("figurant_id", figurant.id).eq("endpoint", endpoint);
  if (error) return { error: error.message };
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
  // Publicly callable Server Actions must never use service_role unauthenticated.
  const staff = await getCurrentProfile();
  if (!staff) return { error: "Non autorisé." };
  if (projetId) {
    const denied = await checkProjetAccess(projetId);
    if (denied) return { error: denied };
  } else if (staff.role !== "chef") {
    return { error: "Réservé au·à la chef·fe." };
  }
  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, email, acces_compte")
    .eq("id", figurantId)
    .single();

  if (!figurant) return { success: true as const };

  const etaitDejaActif = figurant.acces_compte;
  if (!etaitDejaActif) {
    const { error: activationError } = await supabase.from("figurants").update({ acces_compte: true }).eq("id", figurantId);
    if (activationError) return { error: activationError.message };
  }
  // Compte créé par la personne elle-même : pas de lien « espace prêt »,
  // réservé aux profils ajoutés à la main.
  if (await aCreeSonCompte(figurantId)) {
    revalidatePath(`/figurants/${figurantId}`);
    return { success: true as const };
  }
  // Compte créé par la personne elle-même : pas de lien « espace prêt »,
  // réservé aux profils ajoutés à la main.
  if (await aCreeSonCompte(figurantId)) {
    revalidatePath(`/figurants/${figurantId}`);
    return { success: true as const };
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

  const { error: messageError } = await supabase.from("figurant_messages").insert({
    figurant_id: figurantId,
    projet_id: projetId ?? null,
    sender: "staff",
    envoye_par: (await getCurrentProfile())?.id ?? null,
    corps: "Lien d'accès à l'espace personnel envoyé.",
    categorie: "espace_perso",
  });
  if (messageError) return { error: "Accès activé, mais historique de l'envoi non enregistré." };

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

// Bascule manuelle depuis la fiche figurant (accorder ou révoquer), pour les
// cas hors du flux candidature normal. projetId = projet actuellement
// sélectionné (bandeau du haut), pour que l'envoi respecte la même boîte
// Gmail (et la même obligation de config pour les cheffes non-admin) que le
// reste de la messagerie sur cette fiche partagée.
export async function toggleAccesCompte(figurantId: string, value: boolean, projetId?: string | null) {
  const staff = await getCurrentProfile();
  if (!staff) return { error: "Non autorisé." };
  if (projetId) {
    const denied = await checkProjetAccess(projetId);
    if (denied) return { error: denied };
  } else if (staff.role !== "chef") {
    return { error: "Réservé au·à la chef·fe." };
  }
  if (value) return activerAccesCompte(figurantId, projetId);
  // Révoquer l'accès d'un compte : réservé aux comptes à accès complet.
  if (!aAccesComplet(await getCurrentProfile())) return { error: "Seuls Loïc, Mathieu et Eléa peuvent révoquer un accès." };

  const supabase = createAdminClient();
  const { error: updateError } = await supabase.from("figurants").update({ acces_compte: false }).eq("id", figurantId);
  if (updateError) return { error: updateError.message };
  // Invalidate both active sessions and unused login links upon revocation.
  const { error: sessionsError } = await supabase.from("figurant_sessions").delete().eq("figurant_id", figurantId);
  const { error: tokensError } = await supabase.from("figurant_auth_tokens").delete().eq("figurant_id", figurantId);
  if (sessionsError || tokensError) return { error: "Accès désactivé, mais la révocation des sessions ou liens doit être vérifiée." };
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
    vehicule_voiture: fd.get("vehicule_voiture") === "on",
    vehicule_velo: fd.get("vehicule_velo") === "on",
    vehicule_moto: fd.get("vehicule_moto") === "on",
    vehicule_scooter: fd.get("vehicule_scooter") === "on",
    vehicule_marque: str(fd, "vehicule_marque"),
  };
}

// Le candidat ne modifie que sa PROPRE fiche — l'id vient de sa session,
// jamais d'un champ du formulaire, pour ne jamais pouvoir modifier un autre
// profil.
export async function updateMaFiche(_prevState: unknown, formData: FormData): Promise<{ error?: string; success?: true }> {
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
  const pointure = num(formData, "pointure");
  if (pointure !== null && (pointure < 15 || pointure > 60)) {
    return { error: "La pointure doit être comprise entre 15 et 60." };
  }

  const birth = str(formData, "date_naissance") ?? "";
  const guardians = readGuardians(formData, birth, email);
  if ("error" in guardians) return guardians;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Adresse email invalide." };
  const supabase = createAdminClient();
  const { error: identityError } = await supabase.rpc("update_candidate_identity", { p_id: session.id, p_email: email, p_birth: birth, p_guardians: guardians.data });
  if (identityError) return { error: "L’identité n’a pas pu être enregistrée. Vérifie la date de naissance et les trois emails." };
  const { error } = await supabase
    .from("figurants")
    .update({
      telephone,
      ville,
      adresse,
      code_postal: codePostal,
      commune_naissance: communeNaissance,

      genre,
      pronom,
      taille_cm: num(formData, "taille_cm"),
      poids_kg: num(formData, "poids_kg"),
      pointure,
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
      compte_myrole: formData.get("compte_myrole") === "on",
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
  if (existing === null) return { error: "Impossible de vérifier le nombre de photos. Réessaie." };
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
