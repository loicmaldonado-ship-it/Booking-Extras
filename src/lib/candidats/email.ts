import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { retourAutorise } from "@/lib/candidats/retour";
import { getSiteOrigin } from "@/lib/partage/data";
import { sendEmail } from "@/lib/email/send";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { getEmailTemplate, applyEmailTemplate } from "@/lib/projets/email-templates";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function genToken() {
  return randomUUID().replace(/-/g, "");
}

async function createMagicLinkToken(figurantId: string, retour?: string | null) {
  const supabase = createAdminClient();
  const token = genToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error } = await supabase
    .from("figurant_auth_tokens")
    .insert({ figurant_id: figurantId, token, expires_at: expiresAt.toISOString() });
  if (error) return { error: "Une erreur est survenue, réessayez." };

  const origin = await getSiteOrigin();
  const suite = retourAutorise(retour);
  return { link: `${origin}/compte/verifier?token=${token}${suite ? `&retour=${encodeURIComponent(suite)}` : ""}` };
}

// Envoi réel (Gmail SMTP) du lien de connexion — utilisé pour une demande
// volontaire du candidat déjà actif (/compte/connexion). projetId absent
// (demande publique, sans contexte cheffe) => boîte partagée par défaut.
export async function sendMagicLinkEmail(
  figurant: { id: string; prenom: string; email: string },
  projetId?: string | null,
  retour?: string | null
) {
  const { link, error: linkError } = await createMagicLinkToken(figurant.id, retour);
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
        "Votre accès à votre espace personnel Booking Extras est activé.",
        "",
        "Vous pourrez y retrouver vos informations, vos éventuelles dates de tournage et vos échanges de messages.",
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
