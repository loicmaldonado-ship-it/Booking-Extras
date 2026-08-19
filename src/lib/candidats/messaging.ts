import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToFigurant } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import type { FigurantMessageCategorie } from "./types";

// Si un email est fourni, le message part réellement (Gmail SMTP, boîte
// partagée) au lieu d'ouvrir le client mail de la personne qui clique — ainsi
// Loïc et les assistants envoient tous depuis la même adresse.
export async function recordFigurantMessage(params: {
  figurantId: string;
  corps: string;
  categorie: FigurantMessageCategorie;
  bookingId?: string | null;
  email?: string | null;
  subject?: string;
}) {
  const supabase = createAdminClient();
  await supabase.from("figurant_messages").insert({
    figurant_id: params.figurantId,
    booking_id: params.bookingId ?? null,
    sender: "staff",
    corps: params.corps,
    categorie: params.categorie,
  });

  await sendPushToFigurant(params.figurantId, {
    title: "Booking Extras — Vous avez un message",
    body: "Vous avez un nouveau message, merci de vous connecter pour en prendre connaissance.",
    url: "/compte",
  });

  if (params.email) {
    const result = await sendEmail(params.email, params.subject ?? "Booking Extras", params.corps);
    if (result.error) return { error: result.error };
  }
  return {};
}
