import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToFigurant } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { checkProjetAccess } from "@/lib/auth/session";
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
  projetId?: string | null;
}) {
  // projetId ne sert qu'à choisir la boîte Gmail d'envoi — sans cette
  // vérification, n'importe quel appelant pourrait faire envoyer un message
  // "depuis" la boîte d'un projet auquel il n'a pas accès.
  if (params.projetId) {
    const accessError = await checkProjetAccess(params.projetId);
    if (accessError) return { error: accessError };
  }

  const supabase = createAdminClient();

  if (params.email) {
    const { credentials, error } = await getProjetEmailCredentials(supabase, params.projetId);
    if (error) return { error };
    const result = await sendEmail(params.email, params.subject ?? "Booking Extras", params.corps, credentials);
    if (result.error) return { error: result.error };
  }

  await supabase.from("figurant_messages").insert({
    figurant_id: params.figurantId,
    booking_id: params.bookingId ?? null,
    projet_id: params.projetId ?? null,
    sender: "staff",
    corps: params.corps,
    categorie: params.categorie,
  });

  await sendPushToFigurant(params.figurantId, {
    title: "Booking Extras — Vous avez un message",
    body: "Vous avez un nouveau message, merci de vous connecter pour en prendre connaissance.",
    url: "/compte",
  });

  return {};
}
