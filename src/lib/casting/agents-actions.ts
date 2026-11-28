"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import { insertFigurantPhoto } from "@/lib/figurants/photos";

// Lien spécial agent — côté équipe : créer les liens (un par agent), ouvrir des
// rôles aux agents, traiter les propositions reçues. Chaque action revérifie
// l'accès au projet concerné.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUCKET = "agent-propositions";

export async function creerAgent(
  projetId: string,
  champs: { nom: string; agence?: string; email?: string; afficherRepliques?: boolean }
): Promise<{ id?: string; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const nom = champs.nom.replace(/\s+/g, " ").trim().slice(0, 80);
  const email = (champs.email ?? "").trim().toLowerCase();
  if (!nom) return { error: "Donne le nom de l'agent." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };

  const { data, error } = await createAdminClient()
    .from("casting_agents")
    .insert({
      projet_id: projetId,
      nom,
      agence: champs.agence?.trim().slice(0, 80) || null,
      email: email || null,
      afficher_repliques: !!champs.afficherRepliques,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/casting/agents");
  return { id: data.id };
}

async function agentAvecAcces(agentId: string): Promise<{ projetId?: string; error?: string }> {
  const { data } = await createAdminClient().from("casting_agents").select("projet_id").eq("id", agentId).maybeSingle();
  if (!data) return { error: "Agent introuvable." };
  const accessError = await checkProjetAccess(data.projet_id);
  if (accessError) return { error: accessError };
  return { projetId: data.projet_id };
}

// Active / coupe le lien d'un agent, ou change l'accès aux répliques d'essai.
export async function majAgent(
  agentId: string,
  patch: { actif?: boolean; afficherRepliques?: boolean }
): Promise<{ error?: string }> {
  const acces = await agentAvecAcces(agentId);
  if (acces.error) return { error: acces.error };
  const maj: Record<string, boolean> = {};
  if (patch.actif !== undefined) maj.actif = patch.actif;
  if (patch.afficherRepliques !== undefined) maj.afficher_repliques = patch.afficherRepliques;
  if (Object.keys(maj).length === 0) return {};
  const { error } = await createAdminClient().from("casting_agents").update(maj).eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath("/casting/agents");
  return {};
}

// Supprime l'agent, son lien et ses propositions (les profils déjà acceptés restent).
export async function supprimerAgent(agentId: string): Promise<{ error?: string }> {
  const acces = await agentAvecAcces(agentId);
  if (acces.error) return { error: acces.error };
  const supabase = createAdminClient();
  const { data: props } = await supabase.from("casting_propositions_agents").select("photos").eq("agent_id", agentId);
  const chemins = (props ?? []).flatMap((p) => p.photos as string[]);
  if (chemins.length > 0) await supabase.storage.from(BUCKET).remove(chemins);
  const { error } = await supabase.from("casting_agents").delete().eq("id", agentId);
  if (error) return { error: error.message };
  revalidatePath("/casting/agents");
  return {};
}

// Ouvre (ou ferme) des rôles aux agents : ils apparaissent (ou disparaissent) de tous les liens agents.
export async function ouvrirRolesAuxAgents(
  projetId: string,
  roleIds: string[],
  ouvert: boolean
): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();
  for (let i = 0; i < roleIds.length; i += 100) {
    const { error } = await supabase
      .from("casting_roles")
      .update({ ouvert_agents: ouvert })
      .eq("projet_id", projetId)
      .in("id", roleIds.slice(i, i + 100));
    if (error) return { error: error.message };
  }
  revalidatePath("/casting");
  revalidatePath("/casting/agents");
  return {};
}

type PropositionLigne = {
  id: string;
  projet_id: string;
  agent_id: string;
  role_id: string;
  prenom: string;
  nom: string;
  age: string | null;
  taille: string | null;
  lien_page: string | null;
  lien_bande_demo: string | null;
  note: string | null;
  photos: string[];
  statut: string;
  casting_agents: { nom: string; agence: string | null; email: string | null } | null;
  casting_roles: { nom: string; mode: "selftape" | "presentiel"; photo_labels: string[] } | null;
};

const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Accepte une proposition : la personne rejoint ta base privée de comédien·nes
// (ou sa fiche existante est reprise), entre dans le rôle comme profil « proposé »,
// avec les photos, les liens et les coordonnées de l'agent.
export async function accepterProposition(propositionId: string): Promise<{ error?: string; entryId?: string }> {
  const supabase = createAdminClient();
  const { data: p } = await supabase
    .from("casting_propositions_agents")
    .select(
      "id, projet_id, agent_id, role_id, prenom, nom, age, taille, lien_page, lien_bande_demo, note, photos, statut, casting_agents(nom, agence, email), casting_roles(nom, mode, photo_labels)"
    )
    .eq("id", propositionId)
    .maybeSingle<PropositionLigne>();
  if (!p) return { error: "Proposition introuvable." };
  const accessError = await checkProjetAccess(p.projet_id);
  if (accessError) return { error: accessError };
  if (p.statut !== "en_attente") return { error: "Cette proposition a déjà été traitée." };
  if (!p.casting_roles) return { error: "Le rôle n'existe plus." };

  // Base privée de la cheffe du projet (comme les autres entrées sans compte).
  const { data: projet } = await supabase.from("projets").select("owner_id").eq("id", p.projet_id).maybeSingle();
  const { data: proprio } = projet?.owner_id
    ? await supabase.from("profiles").select("id, comedien_pool_id").eq("id", projet.owner_id).maybeSingle()
    : { data: null };
  const poolId = proprio ? (proprio.comedien_pool_id ?? proprio.id) : comedienPoolIdFor(await getCurrentProfile());

  // Même nom déjà dans cette base : on reprend la fiche plutôt que d'en créer une seconde.
  let q = supabase.from("figurants").select("id, nom, prenom, agent_nom, agent_agence, agent_email, taille_cm").eq("est_comedien", true);
  q = poolId ? q.eq("comedien_pool_id", poolId) : q.is("comedien_pool_id", null);
  const { data: candidats } = await q.ilike("nom", p.nom.replace(/[\\%_]/g, "\\$&"));
  const existante = (candidats ?? []).find((f) => normaliser(f.prenom) === normaliser(p.prenom) && normaliser(f.nom) === normaliser(p.nom));

  const agent = p.casting_agents;
  const taille = parseInt((p.taille ?? "").replace(/[^\d]/g, ""), 10);
  const tailleCm = Number.isFinite(taille) && taille >= 80 && taille <= 250 ? taille : null;

  let figurantId: string;
  if (existante) {
    figurantId = existante.id;
    // On complète seulement ce qui manque, sans écraser ce que tu avais déjà saisi.
    const maj: Record<string, string | number> = {};
    if (!existante.agent_nom && agent?.nom) maj.agent_nom = agent.nom;
    if (!existante.agent_agence && agent?.agence) maj.agent_agence = agent.agence;
    if (!existante.agent_email && agent?.email) maj.agent_email = agent.email;
    if (!existante.taille_cm && tailleCm) maj.taille_cm = tailleCm;
    if (Object.keys(maj).length > 0) await supabase.from("figurants").update(maj).eq("id", figurantId);
  } else {
    const { data: creee, error } = await supabase
      .from("figurants")
      .insert({
        prenom: p.prenom,
        nom: p.nom,
        est_comedien: true,
        comedien_pool_id: poolId,
        confirme: true,
        cree_via_casting: true,
        agent_nom: agent?.nom ?? null,
        agent_agence: agent?.agence ?? null,
        agent_email: agent?.email ?? null,
        taille_cm: tailleCm,
      })
      .select("id")
      .single();
    if (error || !creee) return { error: error?.message ?? "Création du profil impossible." };
    figurantId = creee.id;
  }

  // Le profil entre dans le rôle ; l'origine et les infos de l'agent vont dans ses notes.
  const notes = [
    `Proposé par ${agent?.nom ?? "un agent"}${agent?.agence ? ` (${agent.agence})` : ""}`,
    p.age ? `Âge : ${p.age}` : null,
    p.note ? p.note : null,
  ]
    .filter(Boolean)
    .join("\n");
  let entryId: string;
  const { data: dejaLa } = await supabase
    .from("casting_entries")
    .select("id, notes")
    .eq("role_id", p.role_id)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (dejaLa) {
    entryId = dejaLa.id;
    await supabase.from("casting_entries").update({ notes: [dejaLa.notes, notes].filter(Boolean).join("\n\n") }).eq("id", entryId);
  } else {
    const { data: entree, error } = await supabase
      .from("casting_entries")
      .insert({ projet_id: p.projet_id, role_id: p.role_id, figurant_id: figurantId, mode: p.casting_roles.mode, notes })
      .select("id")
      .single();
    if (error || !entree) return { error: error?.message ?? "Entrée dans le rôle impossible." };
    entryId = entree.id;
  }

  // Photos : du stockage des agents vers celles du profil, attachées à ce rôle.
  const etiquettes = p.casting_roles.photo_labels ?? [];
  let erreurPhoto = false;
  for (let i = 0; i < p.photos.length; i++) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(p.photos[i]);
    if (!blob) {
      erreurPhoto = true;
      continue;
    }
    const nomFichier = p.photos[i].split("/").pop() ?? `photo-${i}.jpg`;
    const fichier = new File([blob], nomFichier, { type: blob.type || "image/jpeg" });
    const res = await insertFigurantPhoto(supabase, figurantId, "casting", fichier, {
      projetId: p.projet_id,
      castingEntryId: entryId,
      label: etiquettes[i] ?? "Photo",
    });
    if (res.error) erreurPhoto = true;
  }

  // Liens vers sa page de comédien et sa bande démo.
  const liens = [
    p.lien_page ? { label: "Page comédien·ne", url: p.lien_page } : null,
    p.lien_bande_demo ? { label: "Bande démo", url: p.lien_bande_demo } : null,
  ].filter((l): l is { label: string; url: string } => !!l);
  for (const l of liens) {
    const { data: deja } = await supabase.from("figurant_liens").select("id").eq("figurant_id", figurantId).eq("url", l.url).maybeSingle();
    if (!deja) await supabase.from("figurant_liens").insert({ figurant_id: figurantId, ...l });
  }

  await supabase
    .from("casting_propositions_agents")
    .update({
      statut: "acceptee",
      entry_id: entryId,
      traite_le: new Date().toISOString(),
      // Photos reprises sur le profil : on ne garde plus de trace des fichiers temporaires.
      ...(erreurPhoto ? {} : { photos: [] }),
    })
    .eq("id", propositionId);
  if (!erreurPhoto && p.photos.length > 0) await supabase.storage.from(BUCKET).remove(p.photos);

  revalidatePath("/casting");
  revalidatePath("/casting/agents");
  return erreurPhoto ? { entryId, error: "Profil ajouté, mais certaines photos n'ont pas pu être reprises." } : { entryId };
}

export async function refuserProposition(propositionId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { data: p } = await supabase
    .from("casting_propositions_agents")
    .select("projet_id, photos, statut")
    .eq("id", propositionId)
    .maybeSingle();
  if (!p) return { error: "Proposition introuvable." };
  const accessError = await checkProjetAccess(p.projet_id);
  if (accessError) return { error: accessError };
  if (p.statut !== "en_attente") return { error: "Cette proposition a déjà été traitée." };

  await supabase
    .from("casting_propositions_agents")
    .update({ statut: "refusee", traite_le: new Date().toISOString(), photos: [] })
    .eq("id", propositionId);
  // Les photos d'une proposition refusée ne sont pas gardées.
  if ((p.photos as string[]).length > 0) await supabase.storage.from(BUCKET).remove(p.photos as string[]);
  revalidatePath("/casting/agents");
  return {};
}
