"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToFigurant } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import type { FigurantMessageCategorie } from "@/lib/candidats/types";

export async function sendStaffMessageToFigurant(figurantId: string, formData: FormData) {
  const corps = String(formData.get("corps") ?? "").trim();
  const categorie = (String(formData.get("categorie") ?? "libre").trim() ||
    "libre") as FigurantMessageCategorie;
  const email = String(formData.get("email") ?? "").trim() || null;
  if (!corps) return { error: "Le message ne peut pas être vide." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurant_messages")
    .insert({ figurant_id: figurantId, sender: "staff", corps, categorie });

  if (error) return { error: error.message };

  await sendPushToFigurant(figurantId, {
    title: "Booking Extras — Vous avez un message",
    body: corps.length > 100 ? `${corps.slice(0, 100)}...` : corps,
    url: "/compte",
  });

  let emailError: string | undefined;
  if (email) {
    const result = await sendEmail(email, "Booking Extras", corps);
    emailError = result.error;
  }

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true, emailError };
}

export async function notifyFigurantByEmail(figurantId: string, email: string, prenom: string, siteUrl: string) {
  const result = await sendEmail(
    email,
    "Booking Extras — Vous avez un message",
    `Bonjour ${prenom},\n\nVous avez un nouveau message sur votre espace Booking Extras, merci de vous connecter très rapidement :\n${siteUrl}/compte/connexion\n\nMerci !`
  );
  return result;
}

// Coché manuellement par l'équipe dans le suivi des envois — distinct du
// "BIEN REÇU" que le figurant coche lui-même côté /compte.
export async function toggleMessageRepondu(messageId: string, value: boolean) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("figurant_messages").update({ repondu: value }).eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
