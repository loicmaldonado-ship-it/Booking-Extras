"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToFigurant } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import { getCurrentProjetId } from "@/lib/projet-context";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import { getProjetEmailCredentials, getOwnerEmailCredentials, type EmailCredentialsResult } from "@/lib/projets/email";
import type { FigurantMessageCategorie } from "@/lib/candidats/types";

// Base Profils est partagé entre cheffes, sans projet "propriétaire" du
// message — on rattache donc le message au projet actuellement sélectionné
// (bandeau du haut) si la personne qui écrit en a un, pour qu'il reste
// cloisonné comme les autres (voir /figurants/[id]) et parte de la bonne
// boîte, sinon celle de la cheffe qui écrit, sinon la boîte partagée.
async function resolveSenderCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null
): Promise<EmailCredentialsResult> {
  if (projetId) return getProjetEmailCredentials(supabase, projetId);

  const profile = await getCurrentProfile();
  return getOwnerEmailCredentials(supabase, profile?.id ?? null);
}

// Server Actions bypass the UI. Authorize the staff actor and the requested
// project before touching private records with the service-role client.
async function requireStaffMessageAccess(figurantId: string, projetId: string | null) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "Non autorisé." } as const;
  if (projetId) {
    const denied = await checkProjetAccess(projetId);
    if (denied) return { error: denied } as const;
  }
  const { data: figurant } = await createAdminClient()
    .from("figurants")
    .select("email, prenom, est_comedien, comedien_pool_id")
    .eq("id", figurantId)
    .maybeSingle();
  if (!figurant) return { error: "Profil introuvable." } as const;
  if (figurant.est_comedien && !actor.isOwner &&
      figurant.comedien_pool_id !== comedienPoolIdFor(actor)) {
    return { error: "Profil introuvable." } as const;
  }
  return { figurant } as const;
}

export async function sendStaffMessageToFigurant(figurantId: string, formData: FormData) {
  const corps = String(formData.get("corps") ?? "").trim();
  const categorie = (String(formData.get("categorie") ?? "libre").trim() ||
    "libre") as FigurantMessageCategorie;
  const requestedEmail = String(formData.get("email") ?? "").trim() || null;
  if (!corps) return { error: "Le message ne peut pas être vide." };

  const projetId = await getCurrentProjetId();
  const access = await requireStaffMessageAccess(figurantId, projetId);
  if ("error" in access) return { error: access.error };
  // Never trust the email supplied by the browser as the recipient.
  const storedEmail = access.figurant.email;
  if (requestedEmail && requestedEmail.toLowerCase() !== storedEmail?.toLowerCase()) {
    return { error: "Adresse du destinataire invalide." };
  }
  const supabase = createAdminClient();

  let emailError: string | undefined;
  let emailEnvoye = false;
  if (requestedEmail && storedEmail) {
    const { credentials, error: credError } = await resolveSenderCredentials(supabase, projetId);
    if (credError) return { error: credError };
    const result = await sendEmail(storedEmail, "Booking Extras", corps, credentials);
    emailError = result.error;
    emailEnvoye = !result.error;
  }

  const { error } = await supabase
    .from("figurant_messages")
    .insert({ figurant_id: figurantId, sender: "staff", corps, categorie, projet_id: projetId, envoye_par: (await getCurrentProfile())?.id ?? null });

  if (error) return { error: emailEnvoye
    ? "L’email a été envoyé, mais l’enregistrement du message n’a pas pu être confirmé. Vérifie la messagerie avant de réessayer."
    : "Impossible de confirmer l’enregistrement du message. Recharge la page avant de réessayer." };

  await sendPushToFigurant(figurantId, {
    title: "Booking Extras — Vous avez un message",
    body: corps.length > 100 ? `${corps.slice(0, 100)}...` : corps,
    url: "/compte",
  });

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true, emailError };
}

export async function notifyFigurantByEmail(figurantId: string) {
  const projetId = await getCurrentProjetId();
  const access = await requireStaffMessageAccess(figurantId, projetId);
  if ("error" in access) return { error: access.error };
  if (!access.figurant.email) return { error: "Ce profil n'a pas d'adresse email." };

  const supabase = createAdminClient();
  const { credentials, error } = await resolveSenderCredentials(supabase, projetId);
  if (error) return { error };
  // URL from trusted server configuration, never a browser-provided URL.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return sendEmail(
    access.figurant.email,
    "Booking Extras — Vous avez un message",
    `Bonjour ${access.figurant.prenom ?? ""},\n\nVous avez un nouveau message sur votre espace Booking Extras. Merci de vous connecter dès que possible pour le consulter et vérifier que vos informations sont bien à jour :\n${siteUrl}/compte/connexion\n\nMerci !`,
    credentials
  );
}

// Coché manuellement par l'équipe dans le suivi des envois — distinct du
// "BIEN REÇU" que le figurant coche lui-même côté /compte.
export async function toggleMessageRepondu(messageId: string, value: boolean) {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "Non autorisé." };
  const supabase = createAdminClient();
  const { data: message } = await supabase.from("figurant_messages")
    .select("figurant_id, projet_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) return { error: "Message introuvable." };
  const access = await requireStaffMessageAccess(message.figurant_id, message.projet_id);
  if ("error" in access) return { error: access.error };

  const { error } = await supabase.from("figurant_messages").update({ repondu: value }).eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath("/bookings/documents");
  return { success: true as const };
}
