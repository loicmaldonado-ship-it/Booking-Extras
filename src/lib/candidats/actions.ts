"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailtoHref } from "@/lib/bookings/convocation";
import { getSiteOrigin } from "@/lib/partage/data";
import { clearFigurantSessionCookie, getCurrentFigurant } from "./session";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function genToken() {
  return randomUUID().replace(/-/g, "");
}

export async function requestMagicLink(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; mailtoUrl?: string; sentTo?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Merci de renseigner votre email." };

  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, email")
    .ilike("email", email)
    .maybeSingle();

  if (!figurant?.email) {
    return { error: "Aucun compte ne correspond à cet email. Vérifiez votre saisie ou contactez le casting." };
  }

  const token = genToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error } = await supabase
    .from("figurant_auth_tokens")
    .insert({ figurant_id: figurant.id, token, expires_at: expiresAt.toISOString() });

  if (error) return { error: "Une erreur est survenue, réessayez." };

  const origin = await getSiteOrigin();
  const link = `${origin}/compte/verifier?token=${token}`;

  const subject = "Booking Extras — votre lien de connexion";
  const body = [
    `Bonjour ${figurant.prenom},`,
    "",
    "Voici votre lien de connexion à votre espace Booking Extras (valable 30 minutes) :",
    link,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  ].join("\n");

  const mailtoUrl = mailtoHref(figurant.email, subject, body);

  return { mailtoUrl, sentTo: figurant.email };
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
