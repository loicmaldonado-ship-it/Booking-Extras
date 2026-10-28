import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToFigurant } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import { getOwnerEmailCredentials, getProjetEmailCredentials } from "@/lib/projets/email";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
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
  cc?: string | null;
  subject?: string;
  projetId?: string | null;
  attachments?: { filename: string; content: Buffer }[];
  html?: string;
}) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "Non autorisé." };
  if (typeof params.corps !== "string" || !params.corps.trim() || params.corps.length > 10000) return { error: "Message invalide." };
  const supabase = createAdminClient();
  let projetId = params.projetId ?? null;
  if (params.bookingId) {
    const { data: booking, error } = await supabase.from("bookings").select("projet_id, figurant_id").eq("id", params.bookingId).maybeSingle();
    if (error || !booking || booking.figurant_id !== params.figurantId || (projetId && projetId !== booking.projet_id)) return { error: "Booking introuvable." };
    projetId = booking.projet_id;
  }
  if (projetId) {
    const denied = await checkProjetAccess(projetId);
    if (denied) return { error: denied };
  }
  const scoped = await createServerSupabaseClient();
  const { data: person, error: personError } = await scoped.from("figurants").select("id, email, agent_email").eq("id", params.figurantId).maybeSingle();
  if (personError || !person) return { error: "Profil introuvable." };
  const allowed = new Set([person.email, person.agent_email].filter(Boolean).map((x: string) => x.trim().toLowerCase()));
  const targets = [params.email, params.cc].filter(Boolean).flatMap(x => String(x).split(/[,;]/)).map(x => x.trim().toLowerCase()).filter(Boolean);
  if (targets.some(x => !allowed.has(x))) return { error: "Le destinataire doit correspondre au profil ou à son agent." };
  // Le message existe avant tout envoi : une panne DB ne déclenche pas d'email,
  // une panne SMTP ne détruit pas le message de l'espace candidat.
  const { error: insertError } = await supabase.from("figurant_messages").insert({
    figurant_id: params.figurantId, booking_id: params.bookingId ?? null,
    projet_id: projetId, sender: "staff", envoye_par: actor.id,
    corps: params.corps, categorie: params.categorie,
  });
  if (insertError) return { error: "Enregistrement du message impossible. Aucun envoi effectué." };
  try {
    await sendPushToFigurant(params.figurantId, {
      title: "Booking Extras — Vous avez un message",
      body: "Vous avez un nouveau message, merci de vous connecter pour en prendre connaissance.", url: "/compte",
    });
  } catch {
    return { error: "Message enregistré ; notification impossible et email non envoyé. Vérifie avant de réessayer.", messageEnregistre: true };
  }
  const to = params.email || params.cc;
  if (to) {
    let credentials;
    try {
      credentials = projetId ? await getProjetEmailCredentials(supabase, projetId) : await getOwnerEmailCredentials(supabase, actor.id);
    } catch {
      return { error: "Message enregistré ; configuration email inaccessible, aucun email envoyé.", messageEnregistre: true };
    }
    if (credentials.error) return { error: "Message enregistré ; " + credentials.error, messageEnregistre: true };
    let sent;
    try {
      sent = await sendEmail(to, params.subject ?? "Booking Extras", params.corps, credentials.credentials, {
        cc: params.email ? params.cc : undefined, attachments: params.attachments, html: params.html,
      });
    } catch {
      return { error: "Message enregistré ; statut de l’email inconnu. Vérifie avant de réessayer.", messageEnregistre: true };
    }
    if (sent.error) return { error: "Message enregistré ; email non envoyé : " + sent.error, messageEnregistre: true };
  }
  return {};
}
