import "server-only";
import { randomUUID } from "crypto";
import { formatPrenom } from "@/lib/noms";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { getSiteOrigin } from "@/lib/partage/data";
import { sendEmail } from "@/lib/email/send";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { retourAutorise } from "@/lib/candidats/retour";
import { aCreeSonCompte } from "@/lib/candidats/mot-de-passe";
import { emailMasque } from "@/lib/candidats/profil";

// Lien « Crée ton compte » : pour les profils de la base sans compte
// (ajout rapide dans Bookings, anciennes fiches). Il n'ouvre que
// /compte/creer, où la personne choisit son mot de passe.
export const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Pas de nouveau mail si un lien encore valide est parti il y a moins de
// 10 minutes (double clic, formulaire renvoyé).
const ANTI_REPETITION_MS = 10 * 60 * 1000;

export type ResultatInvitation = "envoyee" | "deja_envoyee" | "compte_existant" | "pas_email" | { erreur: string; emailEnvoye?: boolean };

export async function envoyerInvitationCompte(
  figurantId: string,
  projetId: string | null,
  retour?: string | null
): Promise<ResultatInvitation> {
  const supabase = createAdminClient();
  const { data: figurant, error: figurantError } = await supabase
    .from("figurants")
    .select("id, prenom, email")
    .eq("id", figurantId)
    .maybeSingle();
  if (figurantError || !figurant) return { erreur: "Impossible de vérifier le profil avant invitation." };
  if (!figurant.email) return "pas_email";
  try {
    if (await aCreeSonCompte(figurantId)) return "compte_existant";
  } catch {
    return { erreur: "Impossible de vérifier le compte candidat avant invitation." };
  }

  const { data: recent, error: recentError } = await supabase
    .from("figurant_auth_tokens")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("objet", "creation_compte")
    .is("used_at", null)
    .gt("created_at", new Date(Date.now() - ANTI_REPETITION_MS).toISOString())
    .limit(1);
  if (recentError) return { erreur: "Impossible de vérifier les invitations précédentes." };
  if (recent && recent.length > 0) return "deja_envoyee";

  const token = randomUUID().replace(/-/g, "");
  const { error: tokenError } = await supabase.from("figurant_auth_tokens").insert({
    figurant_id: figurantId,
    token,
    objet: "creation_compte",
    expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
  });
  if (tokenError) return { erreur: "Lien impossible à créer." };

  const suite = retourAutorise(retour);
  const lien = `${await getSiteOrigin()}/compte/creer?token=${token}${suite ? `&retour=${encodeURIComponent(suite)}` : ""}`;
  const corps = [
    `Bonjour ${formatPrenom(figurant.prenom)},`,
    "",
    "Notre équipe de casting vous a ajouté·e à sa base de profils.",
    "",
    "Pour recevoir vos dates de tournage, échanger avec nous et postuler à nos prochaines annonces, créez votre compte (gratuit) : il suffit de choisir un mot de passe.",
    lien,
    "",
    "Ce lien est valable 30 jours. Vous pourrez ensuite compléter votre fiche (mensurations, photos).",
    "",
    "Si vous ne nous connaissez pas, ignorez ce message.",
  ].join("\n");

  const { credentials, error: credError } = await getProjetEmailCredentials(supabase, projetId);
  const envoi = credError
    ? { error: credError }
    : await sendEmail(figurant.email, "Booking Extras — créez votre compte", corps, credentials);
  if (envoi.error) {
    // Mail pas parti : lien retiré, un nouvel essai en recréera un.
    const { error: retraitError } = await supabase.from("figurant_auth_tokens").delete().eq("token", token);
    if (retraitError) return { erreur: "L’email n’a pas été envoyé et le lien n’a pas pu être retiré. Vérifie les invitations avant de réessayer." };
    return { erreur: envoi.error };
  }

  // Trace sur la fiche (rubrique « Espace perso ») : évite aussi que le mail
  // « votre espace est prêt » reparte pour ce projet.
  const { error: traceError } = await supabase.from("figurant_messages").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    sender: "staff",
    envoye_par: (await getCurrentProfile())?.id ?? null,
    corps: "Invitation à créer son compte envoyée.",
    categorie: "espace_perso",
  });
  if (traceError) return { erreur: "L’email a été envoyé, mais sa trace n’a pas pu être enregistrée. Vérifie avant de renvoyer.", emailEnvoye: true };
  return "envoyee";
}

// Postuler / s'inscrire / se connecter avec l'email (ou nom + téléphone)
// d'une fiche déjà dans la base mais sans compte : pas de doublon, on
// envoie le lien « Crée ton compte » à l'adresse de la fiche. null = la
// fiche a déjà son compte (ou pas d'email) : comportement habituel.
export async function invitationPourFicheSansCompte(
  figurantId: string,
  projetId: string | null,
  retour: string | null
): Promise<{ error: string; invitationEnvoyee: boolean } | null> {
  if (await aCreeSonCompte(figurantId)) return null;
  const { data: figurant } = await createAdminClient().from("figurants").select("email").eq("id", figurantId).maybeSingle();
  if (!figurant?.email) return null;
  const res = await envoyerInvitationCompte(figurantId, projetId, retour);
  if (res === "compte_existant" || res === "pas_email") return null;
  if (typeof res === "object" && res.emailEnvoye) {
    return { invitationEnvoyee: true, error: `Un lien vient d’être envoyé à ${emailMasque(figurant.email)}. Ouvre-le pour créer ton compte.` };
  }
  if (typeof res === "object") {
    console.error("[invitationPourFicheSansCompte]", res.erreur);
    return {
      invitationEnvoyee: false,
      error: "Ta fiche est déjà dans notre base, mais sans compte, et le lien pour le créer n'a pas pu partir. Réessaie dans un moment ou contacte le casting.",
    };
  }
  return {
    invitationEnvoyee: true,
    error: `Ta fiche est déjà dans notre base (le casting t'y a ajouté·e), mais tu n'as pas encore de compte. On vient d'envoyer un lien à ${emailMasque(figurant.email)} : ouvre-le et choisis ton mot de passe${retour ? ", tu reviendras ici avec tes infos remplies" : ""}.`,
  };
}
