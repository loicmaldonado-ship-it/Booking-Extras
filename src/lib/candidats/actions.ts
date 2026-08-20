"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/partage/data";
import { sendEmail } from "@/lib/email/send";
import { LIEN_BANDE_DEMO, LIEN_INSTAGRAM } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
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
// volontaire du candidat déjà actif (/compte/connexion).
export async function sendMagicLinkEmail(figurant: { id: string; prenom: string; email: string }) {
  const { link, error: linkError } = await createMagicLinkToken(figurant.id);
  if (linkError || !link) return { error: linkError };

  const subject = "Booking Extras — votre lien de connexion";
  const body = [
    `Bonjour ${figurant.prenom},`,
    "",
    "Voici votre lien de connexion à votre espace Booking Extras (valable 30 minutes) :",
    link,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  ].join("\n");

  const result = await sendEmail(figurant.email, subject, body);
  if (result.error) return { error: result.error };
  return { success: true as const };
}

// Envoyé une seule fois, au moment où l'accès à l'espace personnel s'active
// (candidature passée à "retenu", ou activation manuelle par le staff) —
// texte différent du simple renvoi de lien : explique le statut "retenu"
// et à quoi sert l'espace.
export async function sendAccesCompteActiveEmail(figurant: { id: string; prenom: string; email: string }) {
  const { link, error: linkError } = await createMagicLinkToken(figurant.id);
  if (linkError || !link) return { error: linkError };

  const subject = "Booking Extras — votre espace personnel est prêt";
  const body = [
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

  const result = await sendEmail(figurant.email, subject, body);
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
    await supabase.from("bookings").update({ reponse_recue: true }).eq("id", message.booking_id);
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

export async function sendFigurantReply(_prevState: unknown, formData: FormData) {
  const figurant = await getCurrentFigurant();
  if (!figurant) return { error: "Non connecté." };

  const corps = String(formData.get("corps") ?? "").trim();
  if (!corps) return { error: "Le message ne peut pas être vide." };

  const supabase = createAdminClient();

  const { count: unacknowledged } = await supabase
    .from("figurant_messages")
    .select("id", { count: "exact", head: true })
    .eq("figurant_id", figurant.id)
    .eq("sender", "staff")
    .eq("bien_recu", false);

  if ((unacknowledged ?? 0) > 0) {
    return { error: "Merci de cocher « BIEN REÇU » sur les messages en attente avant de répondre." };
  }

  const { error } = await supabase
    .from("figurant_messages")
    .insert({ figurant_id: figurant.id, sender: "figurant", corps, bien_recu: true });

  if (error) return { error: error.message };
  revalidatePath("/compte");
  return { success: true };
}

// Débloque l'accès à /compte pour ce figurant (idempotent — ne renvoie pas
// l'email si l'accès est déjà actif). Appelé automatiquement quand une
// candidature passe à "retenu", ou manuellement depuis la fiche figurant.
export async function activerAccesCompte(figurantId: string) {
  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, email, acces_compte")
    .eq("id", figurantId)
    .single();

  if (!figurant || figurant.acces_compte) return { success: true as const };

  await supabase.from("figurants").update({ acces_compte: true }).eq("id", figurantId);

  let emailError: string | undefined;
  if (figurant.email) {
    const result = await sendAccesCompteActiveEmail({ id: figurant.id, prenom: figurant.prenom, email: figurant.email });
    emailError = result.error;
  }

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const, emailError };
}

// Bascule manuelle depuis la fiche figurant (accorder ou révoquer), pour les
// cas hors du flux candidature normal.
export async function toggleAccesCompte(figurantId: string, value: boolean) {
  const supabase = createAdminClient();
  if (value) return activerAccesCompte(figurantId);

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

// Le candidat ne modifie que sa PROPRE fiche — l'id vient de sa session,
// jamais d'un champ du formulaire, pour ne jamais pouvoir modifier un autre
// profil.
export async function updateMaFiche(_prevState: unknown, formData: FormData) {
  const session = await getCurrentFigurant();
  if (!session) return { error: "Non connecté." };

  const email = str(formData, "email");
  const telephone = str(formData, "telephone");
  if (!email || !telephone) {
    return { error: "Email et téléphone sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurants")
    .update({
      email,
      telephone,
      ville: str(formData, "ville"),
      adresse: str(formData, "adresse"),
      taille_cm: num(formData, "taille_cm"),
      poids_kg: num(formData, "poids_kg"),
      pointure: num(formData, "pointure"),
      veste: str(formData, "veste"),
      pantalon: str(formData, "pantalon"),
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
