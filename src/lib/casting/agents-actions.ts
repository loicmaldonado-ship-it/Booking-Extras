"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { sendEmail } from "@/lib/email/send";
import { getProjetEmailCredentials } from "@/lib/projets/email";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";
import { getSiteOrigin } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";
import { composerMailAgent } from "./agents-mail";

// Lien spécial agent — côté équipe : créer les liens (un par agent), ouvrir des
// rôles aux agents, traiter les propositions reçues. Chaque action revérifie
// l'accès au projet concerné.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUCKET = "agent-propositions";

// Trouve l'agent dans la base commune (par l'id choisi dans les suggestions, sinon
// par email, sinon par nom) ou l'y ajoute. Un agent déjà connu n'est jamais modifié :
// seuls ses champs vides sont complétés.
async function agentDeLaBase(
  agentId: string | undefined,
  champs: { nom: string; agence: string | null; email: string | null }
): Promise<string | null> {
  const supabase = createAdminClient();
  let existant: { id: string; agence: string | null; email: string | null } | null = null;
  if (agentId) {
    const { data } = await supabase.from("agents").select("id, agence, email").eq("id", agentId).maybeSingle();
    existant = data;
  }
  if (!existant && champs.email) {
    const { data } = await supabase.from("agents").select("id, agence, email").ilike("email", champs.email.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
    existant = data;
  }
  if (!existant) {
    const { data } = await supabase.from("agents").select("id, agence, email").ilike("nom", champs.nom.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
    existant = data;
  }
  if (existant) {
    const completer: Record<string, string> = {};
    if (!existant.agence && champs.agence) completer.agence = champs.agence;
    if (!existant.email && champs.email) completer.email = champs.email;
    if (Object.keys(completer).length > 0) {
      await supabase.from("agents").update({ ...completer, updated_at: new Date().toISOString() }).eq("id", existant.id);
    }
    return existant.id;
  }
  const { data: cree } = await supabase
    .from("agents")
    .insert({ nom: champs.nom, agence: champs.agence, email: champs.email })
    .select("id")
    .single();
  return cree?.id ?? null;
}

export async function creerAgent(
  projetId: string,
  champs: { nom: string; agence?: string; email?: string; afficherRepliques?: boolean; agentId?: string }
): Promise<{ id?: string; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const nom = champs.nom.replace(/\s+/g, " ").trim().slice(0, 80);
  const email = (champs.email ?? "").trim().toLowerCase();
  if (!nom) return { error: "Donne le nom de l'agent." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  const agence = champs.agence?.trim().slice(0, 80) || null;

  // Rattaché à la base commune des agents (créé là-bas s'il n'y est pas encore).
  const baseId = await agentDeLaBase(champs.agentId, { nom, agence, email: email || null });

  const { data, error } = await createAdminClient()
    .from("casting_agents")
    .insert({
      projet_id: projetId,
      agent_id: baseId,
      nom,
      agence,
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

// Montre (ou cache) les répliques d'essai à TOUS les agents du projet d'un coup.
export async function afficherRepliquesATous(projetId: string, afficher: boolean): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const { error } = await createAdminClient()
    .from("casting_agents")
    .update({ afficher_repliques: afficher })
    .eq("projet_id", projetId);
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
  casting_agents: {
    nom: string;
    agence: string | null;
    email: string | null;
    agents: { nom: string; agence: string | null; email: string | null; telephone: string | null } | null;
  } | null;
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
      "id, projet_id, agent_id, role_id, prenom, nom, age, taille, lien_page, lien_bande_demo, note, photos, statut, casting_agents(nom, agence, email, agents(nom, agence, email, telephone)), casting_roles(nom, mode, photo_labels)"
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
  let q = supabase.from("figurants").select("id, nom, prenom, agent_nom, agent_agence, agent_email, agent_telephone, taille_cm").eq("est_comedien", true);
  q = poolId ? q.eq("comedien_pool_id", poolId) : q.is("comedien_pool_id", null);
  const { data: candidats } = await q.ilike("nom", p.nom.replace(/[\\%_]/g, "\\$&"));
  const existante = (candidats ?? []).find((f) => normaliser(f.prenom) === normaliser(p.prenom) && normaliser(f.nom) === normaliser(p.nom));

  // Coordonnées de l'agent : celles de la base commune si le lien y est rattaché (plus à jour), sinon celles saisies sur le lien.
  const lien = p.casting_agents;
  const base = lien?.agents ?? null;
  const agent = lien
    ? { nom: base?.nom ?? lien.nom, agence: base?.agence ?? lien.agence, email: base?.email ?? lien.email, telephone: base?.telephone ?? null }
    : null;
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
    if (!existante.agent_telephone && agent?.telephone) maj.agent_telephone = agent.telephone;
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
        agent_telephone: agent?.telephone ?? null,
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

// ----- Envoi groupé des liens -----

export type CibleEnvoiAgent = { lienId?: string; baseId?: string };
export type ResultatEnvoiAgent = { nom: string; ok: boolean; message: string };

const MAX_ENVOIS = 30;

// Envoie à plusieurs agents d'un coup leur lien personnel, par email. Pour un agent de
// la base qui n'a pas encore de lien sur ce projet, le lien est créé à ce moment-là.
// Chaque envoi est indépendant : une adresse refusée n'arrête pas les autres.
export async function envoyerLiensAgents(
  projetId: string,
  cibles: CibleEnvoiAgent[],
  sujetModele: string,
  corpsModele: string,
  afficherRepliques: boolean
): Promise<{ resultats?: ResultatEnvoiAgent[]; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  if (cibles.length === 0) return { error: "Choisis au moins un agent." };
  if (cibles.length > MAX_ENVOIS) return { error: `${MAX_ENVOIS} agents au maximum par envoi.` };
  if (!sujetModele.trim() || !corpsModele.trim()) return { error: "Le message ne peut pas être vide." };

  const supabase = createAdminClient();
  // Boîte d'envoi du projet : jamais une adresse qui n'est pas la tienne.
  const { credentials, error: erreurBoite } = await getProjetEmailCredentials(supabase, projetId);
  if (erreurBoite) return { error: erreurBoite };

  const [{ data: projet }, signature, origin] = await Promise.all([
    supabase.from("projets").select("nom, confidentiel, nom_code").eq("id", projetId).maybeSingle(),
    getProjetSignatureOrOwnerName(supabase, projetId),
    getSiteOrigin(),
  ]);
  const nomProjet = projetNomPublic(projet);
  const resultats: ResultatEnvoiAgent[] = [];

  for (const cible of cibles) {
    // 1. L'agent et son lien (créé s'il n'existe pas encore).
    let lien: { id: string; nom: string; email: string | null; token: string; actif: boolean } | null = null;
    let nomAffiche = "Agent";
    if (cible.lienId) {
      const { data } = await supabase
        .from("casting_agents")
        .select("id, nom, email, token, actif")
        .eq("id", cible.lienId)
        .eq("projet_id", projetId)
        .maybeSingle();
      lien = data;
      nomAffiche = data?.nom ?? nomAffiche;
    } else if (cible.baseId) {
      const { data: base } = await supabase.from("agents").select("id, nom, agence, email").eq("id", cible.baseId).maybeSingle();
      if (!base) {
        resultats.push({ nom: nomAffiche, ok: false, message: "Agent introuvable dans la base." });
        continue;
      }
      nomAffiche = base.nom;
      const { data: existant } = await supabase
        .from("casting_agents")
        .select("id, nom, email, token, actif")
        .eq("projet_id", projetId)
        .eq("agent_id", base.id)
        .maybeSingle();
      lien = existant;
      if (!lien) {
        const { data: cree } = await supabase
          .from("casting_agents")
          .insert({ projet_id: projetId, agent_id: base.id, nom: base.nom, agence: base.agence, email: base.email, afficher_repliques: afficherRepliques })
          .select("id, nom, email, token, actif")
          .single();
        lien = cree;
      }
      // L'adresse de la base fait foi (le lien peut avoir été créé sans email).
      if (lien && base.email && lien.email !== base.email) lien = { ...lien, email: base.email };
    }
    if (!lien) {
      resultats.push({ nom: nomAffiche, ok: false, message: "Lien introuvable." });
      continue;
    }
    if (!lien.actif) {
      resultats.push({ nom: lien.nom, ok: false, message: "Son lien est coupé : réactive-le avant de l'envoyer." });
      continue;
    }
    if (!lien.email) {
      resultats.push({ nom: lien.nom, ok: false, message: "Pas d'adresse email pour cet agent." });
      continue;
    }

    // 2. Le mail, personnalisé.
    const valeurs = { agent: lien.nom, projet: nomProjet, lien: `${origin}/agent/${lien.token}`, signature };
    const sujet = sujetModele.replaceAll("{projet}", nomProjet).replaceAll("{agent}", lien.nom).slice(0, 200);
    const corps = composerMailAgent(corpsModele, valeurs);
    const res = await sendEmail(lien.email, sujet, corps, credentials);
    if (res.error) {
      resultats.push({ nom: lien.nom, ok: false, message: res.error });
      continue;
    }
    await supabase.from("casting_agents").update({ dernier_envoi_le: new Date().toISOString() }).eq("id", lien.id);
    resultats.push({ nom: lien.nom, ok: true, message: `Envoyé à ${lien.email}` });
  }

  revalidatePath("/casting/agents");
  return { resultats };
}
