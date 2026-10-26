"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { findOrCreateComedienTwin } from "@/lib/figurants/comedien-twin";

// Lien rapide de casting : la personne connectée rejoint le rôle (sa fiche
// casting se crée si besoin) puis arrive sur la page d'envoi des photos /
// vidéos demandées par le rôle.
export async function rejoindreCasting(token: string): Promise<{ error?: string }> {
  const retour = `/casting/rejoindre/${token}`;
  const session = await getCurrentFigurant();
  if (!session) redirect(`/compte/connexion?retour=${encodeURIComponent(retour)}`);

  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("id, projet_id, mode, categorie_cachet, lien_public_actif, date_limite_envoi, projets(owner_id)")
    .eq("public_token", token)
    .maybeSingle<{
      id: string;
      projet_id: string;
      mode: "selftape" | "presentiel";
      categorie_cachet: string;
      lien_public_actif: boolean;
      date_limite_envoi: string | null;
      projets: { owner_id: string | null } | null;
    }>();
  if (!role || !role.lien_public_actif) return { error: "Ce casting n'est plus ouvert." };
  if (role.date_limite_envoi && role.date_limite_envoi < new Date().toISOString().slice(0, 10)) {
    return { error: "La date limite d'envoi est passée." };
  }

  const { data: figurant } = await supabase
    .from("figurants")
    .select("prenom, nom, email, telephone, genre")
    .eq("id", session.id)
    .maybeSingle();
  if (!figurant) return { error: "Compte introuvable." };

  // Rôle « cachet rôle » : comme quand la cheffe envoie un profil, la
  // personne rejoint (ou crée) sa fiche comédien·ne dans le pool de la
  // cheffe du projet ; sa fiche figurant·e n'est pas modifiée.
  let figurantId = session.id;
  if (role.categorie_cachet === "role" && role.projets?.owner_id) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, comedien_pool_id")
      .eq("id", role.projets.owner_id)
      .maybeSingle();
    const twinId = await findOrCreateComedienTwin(
      figurant,
      owner ? { id: owner.id, comedienPoolId: owner.comedien_pool_id } : null
    );
    if (twinId) figurantId = twinId;
  }

  const { data: existante } = await supabase
    .from("casting_entries")
    .select("request_token")
    .eq("role_id", role.id)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  let requestToken = existante?.request_token as string | undefined;
  if (!requestToken) {
    const { data: creee, error } = await supabase
      .from("casting_entries")
      .insert({ projet_id: role.projet_id, role_id: role.id, figurant_id: figurantId, mode: role.mode })
      .select("request_token")
      .single();
    if (error || !creee) return { error: "Inscription au casting impossible, réessaie." };
    requestToken = creee.request_token;
  }

  redirect(`/casting/upload/${requestToken}`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Postuler à un casting SANS compte : identité minimale, puis envoi des
// photos / vidéos. La fiche va dans la base privée de la cheffe du projet
// (pool comédien·nes / casting), jamais dans la Base Profils partagée ; un
// compte reste obligatoire pour postuler aux annonces.
export async function postulerCastingSansCompte(
  token: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const champ = (k: string) => String(formData.get(k) ?? "").trim();
  const prenom = champ("prenom");
  const nom = champ("nom");
  const email = champ("email").toLowerCase();
  const telephone = champ("telephone");
  const genre = champ("genre") || null;
  if (!prenom || !nom) return { error: "Indique ton prénom et ton nom." };
  if (!EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (telephone.replace(/\D/g, "").length < 8) return { error: "Numéro de téléphone invalide." };

  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("id, projet_id, mode, lien_public_actif, date_limite_envoi, projets(owner_id)")
    .eq("public_token", token)
    .maybeSingle<{
      id: string;
      projet_id: string;
      mode: "selftape" | "presentiel";
      lien_public_actif: boolean;
      date_limite_envoi: string | null;
      projets: { owner_id: string | null } | null;
    }>();
  if (!role || !role.lien_public_actif) return { error: "Ce casting n'est plus ouvert." };
  if (role.date_limite_envoi && role.date_limite_envoi < new Date().toISOString().slice(0, 10)) {
    return { error: "La date limite d'envoi est passée." };
  }

  const { data: owner } = role.projets?.owner_id
    ? await supabase.from("profiles").select("id, comedien_pool_id").eq("id", role.projets.owner_id).maybeSingle()
    : { data: null };
  const poolId = owner ? (owner.comedien_pool_id ?? owner.id) : null;

  // Même email déjà dans cette base : on reprend la fiche seulement si c'est
  // bien la même personne (nom identique) — sinon n'importe qui pourrait
  // envoyer des photos sur la fiche de quelqu'un d'autre.
  let existanteQuery = supabase.from("figurants").select("id, nom").eq("est_comedien", true)
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"));
  existanteQuery = poolId ? existanteQuery.eq("comedien_pool_id", poolId) : existanteQuery.is("comedien_pool_id", null);
  const { data: existante } = await existanteQuery.maybeSingle();

  let figurantId: string;
  if (existante) {
    if (normaliser(existante.nom) !== normaliser(nom)) {
      return { error: "Cet email est déjà utilisé par une autre personne pour ce casting. Contacte l'équipe de casting." };
    }
    figurantId = existante.id;
  } else {
    const { data: creee, error } = await supabase
      .from("figurants")
      .insert({
        prenom,
        nom,
        email,
        telephone,
        genre,
        est_comedien: true,
        comedien_pool_id: poolId,
        confirme: true,
        cree_via_casting: true,
      })
      .select("id")
      .single();
    if (error || !creee) return { error: "Inscription au casting impossible, réessaie." };
    figurantId = creee.id;
  }

  const { data: entree } = await supabase
    .from("casting_entries")
    .select("request_token")
    .eq("role_id", role.id)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  let requestToken = entree?.request_token as string | undefined;
  if (!requestToken) {
    const { data: creee, error } = await supabase
      .from("casting_entries")
      .insert({ projet_id: role.projet_id, role_id: role.id, figurant_id: figurantId, mode: role.mode })
      .select("request_token")
      .single();
    if (error || !creee) return { error: "Inscription au casting impossible, réessaie." };
    requestToken = creee.request_token;
  }

  redirect(`/casting/upload/${requestToken}`);
}
