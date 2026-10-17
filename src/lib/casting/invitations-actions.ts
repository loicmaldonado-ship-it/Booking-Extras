"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";
import { projetNomPublic } from "@/lib/projets/types";
import { sendEmail } from "@/lib/email/send";
import { getSiteOrigin } from "@/lib/partage/data";
import { formatDateLong } from "@/lib/format-date";
import { formatTournageClause } from "./types";

// Invitations par email à un rôle, pour des personnes pas encore dans la
// base : le mail contient le lien rapide du rôle (/casting/rejoindre/…),
// où elles créent leur compte puis envoient photos et vidéos.

type RoleInvitation = {
  id: string;
  projet_id: string;
  nom: string;
  public_token: string;
  lien_public_actif: boolean;
  date_tournage: string | null;
  date_tournage_fin: string | null;
  date_limite_envoi: string | null;
  projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
};

async function lireRole(roleId: string): Promise<{ error?: string; role?: RoleInvitation }> {
  const { data: role } = await createAdminClient()
    .from("casting_roles")
    .select(
      "id, projet_id, nom, public_token, lien_public_actif, date_tournage, date_tournage_fin, date_limite_envoi, projets(nom, confidentiel, nom_code)"
    )
    .eq("id", roleId)
    .maybeSingle<RoleInvitation>();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };
  return { role };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function modeleInvitationCasting(
  roleId: string
): Promise<{ error?: string; sujet?: string; corps?: string; dejaInvites?: string[] }> {
  const { error, role } = await lireRole(roleId);
  if (error || !role) return { error };
  const supabase = createAdminClient();
  const [signature, { data: invites }] = await Promise.all([
    getProjetSignatureOrOwnerName(supabase, role.projet_id),
    supabase.from("casting_invitations").select("email").eq("role_id", roleId),
  ]);
  const projet = projetNomPublic(role.projets);
  const tournage = formatTournageClause(role.date_tournage, role.date_tournage_fin);
  const corps = [
    "Bonjour,",
    "",
    `Nous préparons le casting de « ${role.nom} » pour le projet « ${projet} »${tournage ? `, tournage ${tournage}` : ""}, et nous aimerions beaucoup avoir ta candidature.`,
    "",
    "Pour participer, crée ton compte (gratuit) ou connecte-toi, puis envoie tes photos et vidéos ici :",
    "{lien}",
    ...(role.date_limite_envoi ? ["", `Merci de nous répondre avant le ${formatDateLong(role.date_limite_envoi)}.`] : []),
    "",
    "À très vite !",
    signature,
  ].join("\n");
  return {
    sujet: `Casting « ${role.nom} » — ${projet}`,
    corps,
    dejaInvites: (invites ?? []).map((i) => i.email),
  };
}

// Envoie un paquet d'invitations (le client découpe la liste pour rester
// sous la durée max d'une fonction). {lien} est remplacé par le lien rapide.
export async function inviterAuCasting(
  roleId: string,
  emails: string[],
  sujet: string,
  corps: string
): Promise<{ error?: string; envoyes: string[]; echecs: { email: string; raison: string }[] }> {
  const vide = { envoyes: [] as string[], echecs: [] as { email: string; raison: string }[] };
  const { error, role } = await lireRole(roleId);
  if (error || !role) return { ...vide, error };
  if (!role.lien_public_actif) return { ...vide, error: "Le lien rapide de ce rôle est coupé : réactive-le avant d'inviter." };
  if (!corps.includes("{lien}")) return { ...vide, error: "Le message doit contenir {lien} (le lien du casting)." };

  const supabase = createAdminClient();
  const { credentials, error: credError } = await getProjetEmailCredentials(supabase, role.projet_id);
  if (credError) return { ...vide, error: credError };
  const lien = `${await getSiteOrigin()}/casting/rejoindre/${role.public_token}`;
  const texte = corps.replaceAll("{lien}", lien);

  const resultat = { ...vide };
  for (const brut of emails.slice(0, 25)) {
    const email = brut.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      resultat.echecs.push({ email: brut, raison: "adresse invalide" });
      continue;
    }
    const envoi = await sendEmail(email, sujet, texte, credentials);
    if (envoi.error) {
      resultat.echecs.push({ email, raison: envoi.error });
      continue;
    }
    await supabase
      .from("casting_invitations")
      .upsert({ role_id: roleId, email, invite_le: new Date().toISOString() }, { onConflict: "role_id,email" });
    resultat.envoyes.push(email);
  }

  revalidatePath("/casting");
  return resultat;
}
