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
