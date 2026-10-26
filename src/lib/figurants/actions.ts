"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateImageUpload } from "@/lib/media/validate-upload";
import { countFigurantPhotos, insertFigurantPhoto, MAX_PHOTOS_PAR_FIGURANT } from "./photos";
import { upsertAgent } from "@/lib/agents/actions";
import { getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import type { Civilite, Genre, PhotoType, Pronom } from "./types";

// All functions in this module are Server Actions and can be called without
// using the UI. Enforce authorization even when the caller forges an ID.
async function requireStaffFigurantAccess(figurantId?: string): Promise<string | null> {
  const actor = await getCurrentProfile();
  if (!actor) return "Non autorisé.";
  if (!figurantId) return null;

  const { data: person, error } = await (await createServerSupabaseClient()).from("figurants")
    .select("est_comedien, comedien_pool_id").eq("id", figurantId).maybeSingle();
  if (error || !person) return "Profil introuvable.";
  if (person.est_comedien && !actor.isOwner && person.comedien_pool_id !== comedienPoolIdFor(actor)) {
    return "Profil introuvable.";
  }
  return null;
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildFigurantPayload(fd: FormData) {
  return {
    civilite: str(fd, "civilite") as Civilite | null,
    prenom: str(fd, "prenom") ?? "",
    nom: str(fd, "nom") ?? "",
    pronom: str(fd, "pronom") as Pronom | null,
    genre: str(fd, "genre") as Genre | null,
    email: str(fd, "email"),
    telephone: str(fd, "telephone"),
    ville: str(fd, "ville"),
    adresse: str(fd, "adresse"),
    code_postal: str(fd, "code_postal"),
    commune_naissance: str(fd, "commune_naissance"),
    date_naissance: str(fd, "date_naissance"),
    logement_france: str(fd, "logement_france"),
    taille_cm: num(fd, "taille_cm"),
    poids_kg: num(fd, "poids_kg"),
    pointure: num(fd, "pointure"),
    tour_poitrine_cm: num(fd, "tour_poitrine_cm"),
    tour_taille_cm: num(fd, "tour_taille_cm"),
    tour_hanches_cm: num(fd, "tour_hanches_cm"),
    tour_tete_cm: num(fd, "tour_tete_cm"),
    tour_cou_cm: num(fd, "tour_cou_cm"),
    jambes_ext_cm: num(fd, "jambes_ext_cm"),
    jambes_int_cm: num(fd, "jambes_int_cm"),
    carrure_cm: num(fd, "carrure_cm"),
    veste: str(fd, "veste"),
    pantalon: str(fd, "pantalon"),
    gant: str(fd, "gant"),
    couleur_yeux: str(fd, "couleur_yeux"),
    couleur_cheveux: str(fd, "couleur_cheveux"),
    compte_myrole: fd.get("compte_myrole") === "on",
    tags: (str(fd, "tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    notes_internes: str(fd, "notes_internes"),
    est_comedien: fd.get("est_comedien") === "on",
    agent_nom: str(fd, "agent_nom"),
    agent_email: str(fd, "agent_email"),
    agent_telephone: str(fd, "agent_telephone"),
    agent_agence: str(fd, "agent_agence"),
    tranche_age: str(fd, "tranche_age"),
    ...buildVehiculePayload(fd),
  };
}

function buildVehiculePayload(fd: FormData) {
  const aVehicule = str(fd, "a_vehicule");
  return {
    a_vehicule: aVehicule === null ? null : aVehicule === "oui",
    vehicule_voiture: fd.get("vehicule_voiture") === "on",
    vehicule_velo: fd.get("vehicule_velo") === "on",
    vehicule_moto: fd.get("vehicule_moto") === "on",
    vehicule_scooter: fd.get("vehicule_scooter") === "on",
    vehicule_marque: str(fd, "vehicule_marque"),
  };
}

// Minimum pour créer un profil à la main : identité, contact, adresse
// complète (obligatoire à la candidature comme à la création, pour ne
// jamais se retrouver avec un profil sans coordonnées exploitables) et un
// portrait — le reste (mensurations, véhicule) se complète plus tard.
//
// Un profil comédien·ne saute toute cette liste — seul le nom est
// obligatoire : souvent créé vite depuis un book/une fiche d'agence, avant
// même d'avoir ses coordonnées directes (l'agent fait l'intermédiaire).
function requireBaseFields(payload: ReturnType<typeof buildFigurantPayload>): string | null {
  if (!payload.prenom || !payload.nom) {
    return "Prénom et nom sont obligatoires.";
  }
  if (payload.est_comedien) return null;
  if (!payload.email || !payload.telephone) {
    return "Email et téléphone sont obligatoires.";
  }
  if (!payload.adresse || !payload.code_postal || !payload.ville) {
    return "L'adresse de résidence complète (rue, code postal, ville) est obligatoire.";
  }
  if (!payload.commune_naissance) {
    return "La commune de naissance est obligatoire.";
  }
  if (!payload.genre || !payload.pronom) {
    return "Le genre et le pronom sont obligatoires.";
  }
  return null;
}

export async function createFigurant(_prevState: unknown, formData: FormData) {
  const accessError = await requireStaffFigurantAccess();
  if (accessError) return { error: accessError };
  const payload = buildFigurantPayload(formData);
  const fieldsError = requireBaseFields(payload);
  if (fieldsError) return { error: fieldsError };

  const portrait = formData.get("photo_portrait");
  const hasPortrait = portrait instanceof File && portrait.size > 0;
  if (!payload.est_comedien && !hasPortrait) {
    return { error: "Une photo portrait est obligatoire." };
  }
  // Reject invalid bytes *before* inserting the profile, so a failed
  // attachment cannot leave an unusable person row behind.
  if (hasPortrait) {
    const validated = await validateImageUpload(portrait);
    if (validated.error) return { error: validated.error };
  }

  const supabase = createAdminClient();
  // Rattache la fiche au pool comédien·nes de qui la crée (voir
  // comedien-privacy.ts) — sans effet sur les figurant·es, toujours
  // partagé·es.
  const comedienPoolId = payload.est_comedien ? comedienPoolIdFor(await getCurrentProfile()) : null;
  const { data, error } = await supabase
    .from("figurants")
    .insert({ ...payload, confirme: true, comedien_pool_id: comedienPoolId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Un profil existe déjà avec cet email." };
    }
    return { error: error.message };
  }

  if (hasPortrait) {
    const { error: photoError } = await insertFigurantPhoto(supabase, data.id, "portrait", portrait);
    if (photoError) {
      const { error: cleanupError } = await supabase.from("figurants").delete().eq("id", data.id);
      return { error: cleanupError
        ? `${photoError} Le profil a été créé, mais son nettoyage a échoué : ${cleanupError.message}`
        : photoError };
    }
  }

  if (payload.agent_nom) {
    await upsertAgent({
      nom: payload.agent_nom,
      agence: payload.agent_agence,
      email: payload.agent_email,
      telephone: payload.agent_telephone,
    });
  }

  await handleLiens(formData, data.id);

  revalidatePath("/figurants");
  redirect(`/figurants/${data.id}`);
}

async function saveFigurantUpdate(id: string, formData: FormData): Promise<{ error?: string }> {
  const accessError = await requireStaffFigurantAccess(id);
  if (accessError) return { error: accessError };
  const payload = buildFigurantPayload(formData);
  const fieldsError = requireBaseFields(payload);
  if (fieldsError) return { error: fieldsError };

  const supabase = createAdminClient();

  // Ne rattache au pool comédien·nes que si la fiche n'en a pas déjà un —
  // ne change jamais le pool d'une fiche existante en la modifiant (sinon
  // rééditer la fiche d'un·e comédien·ne géré ailleurs la ferait basculer
  // dans le pool de qui édite).
  let comedienPoolId: string | undefined;
  if (payload.est_comedien) {
    const { data: existing } = await supabase.from("figurants").select("comedien_pool_id").eq("id", id).maybeSingle();
    if (!existing?.comedien_pool_id) {
      comedienPoolId = comedienPoolIdFor(await getCurrentProfile()) ?? undefined;
    }
  }

  const { error } = await supabase
    .from("figurants")
    .update(comedienPoolId ? { ...payload, comedien_pool_id: comedienPoolId } : payload)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Un profil existe déjà avec cet email." };
    }
    return { error: error.message };
  }

  if (payload.agent_nom) {
    await upsertAgent({
      nom: payload.agent_nom,
      agence: payload.agent_agence,
      email: payload.agent_email,
      telephone: payload.agent_telephone,
    });
  }

  await handleLiens(formData, id);

  revalidatePath("/figurants");
  revalidatePath(`/figurants/${id}`);
  return {};
}

export async function updateFigurant(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const result = await saveFigurantUpdate(id, formData);
  if (result.error) return result;
  redirect(`/figurants/${id}`);
}

// Même sauvegarde que updateFigurant, mais sans redirection — pour éditer
// la fiche depuis une fenêtre sur place (ex. carte casting) sans quitter la
// page en cours.
export async function updateFigurantInline(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  return saveFigurantUpdate(id, formData);
}

// Édition rapide de l'agent depuis n'importe où (ex. la carte casting) —
// sans repasser par le grand formulaire /modifier. L'agent est rattaché à
// la fiche, pas à une entrée de casting précise : le modifier ici le met à
// jour partout où ce profil apparaît.
export async function updateFigurantAgent(
  figurantId: string,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const accessError = await requireStaffFigurantAccess(figurantId);
  if (accessError) return { error: accessError };
  const agentNom = str(formData, "agent_nom");
  const agentAgence = str(formData, "agent_agence");
  const agentEmail = str(formData, "agent_email");
  const agentTelephone = str(formData, "agent_telephone");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurants")
    .update({
      agent_nom: agentNom,
      agent_email: agentEmail,
      agent_telephone: agentTelephone,
      agent_agence: agentAgence,
    })
    .eq("id", figurantId);
  if (error) return { error: error.message };

  if (agentNom) {
    await upsertAgent({ nom: agentNom, agence: agentAgence, email: agentEmail, telephone: agentTelephone });
  }

  revalidatePath("/figurants");
  revalidatePath(`/figurants/${figurantId}`);
  revalidatePath("/casting");
  return { success: true };
}

// A figurant can be shared by multiple teams: global deletion is restricted
// to the owner and only allowed for an unused, empty profile. To delete
// personal data while keeping production history, use the RGPD flow.
async function deleteUnusedFigurantSecurely(id: string): Promise<{ error?: string; success?: true }> {
  const actor = await getCurrentProfile();
  if (!actor?.isOwner) return { error: "Seul le compte propriétaire peut supprimer définitivement un profil." };

  // The RPC holds a row lock, scans every FK registered in PostgreSQL and
  // aborts the entire transaction before deletion if ANY linked row exists.
  // Never call createAdminClient() here: the RPC verifies auth.uid() itself.
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_unused_figurant", { p_id: id });
  if (error) return { error: "Suppression refusée. Profil introuvable, lié à des données métier ou accès non autorisé. " + error.message };
  revalidatePath("/figurants");
  return { success: true };
}

export async function deleteFigurant(id: string, formData: FormData) {
  if (formData.get("confirmation") !== "SUPPRIMER") return { error: "Confirmation obligatoire : saisis SUPPRIMER." };
  const result = await deleteUnusedFigurantSecurely(id);
  if (result.error) return result;
  redirect("/figurants");
}

export async function supprimerFigurantDoublon(figurantId: string, confirmation: string) {
  if (confirmation !== "SUPPRIMER") return { error: "Confirmation obligatoire." };
  return deleteUnusedFigurantSecurely(figurantId);
}

// Une photo à la fois : un lot de plusieurs photos de téléphone dans une
// seule requête peut dépasser ce que le parseur multipart de Next.js/Node
// encaisse ("Failed to parse body as FormData"), même sous la limite de
// taille configurée. Un fichier par appel reste largement sous ce seuil.
export async function uploadFigurantPhoto(figurantId: string, _prevState: unknown, formData: FormData) {
  const accessError = await requireStaffFigurantAccess(figurantId);
  if (accessError) return { error: accessError };
  const file = formData.get("photo");
  const type = str(formData, "type") as PhotoType | null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisis une photo." };
  }
  if (!type) {
    return { error: "Type de photo manquant." };
  }

  const supabase = createAdminClient();
  const existing = await countFigurantPhotos(supabase, figurantId);
  if (existing >= MAX_PHOTOS_PAR_FIGURANT) {
    return { error: `Maximum ${MAX_PHOTOS_PAR_FIGURANT} photos par profil.` };
  }

  const priseLe = type === "selfie" ? str(formData, "prise_le") : null;
  const result = await insertFigurantPhoto(supabase, figurantId, type, file, { priseLe });
  if (result.error) return { error: result.error };

  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

async function handleLiens(formData: FormData, figurantId: string) {
  const labels = formData.getAll("lien_label");
  const urls = formData.getAll("lien_url");
  if (labels.length === 0) return;

  const supabase = createAdminClient();
  const rows = labels
    .map((label, i) => ({
      figurant_id: figurantId,
      label: String(label ?? "").trim(),
      url: String(urls[i] ?? "").trim(),
    }))
    .filter((r) => r.label && r.url);

  if (rows.length > 0) {
    await supabase.from("figurant_liens").insert(rows);
  }
}

export async function deletePhoto(photoId: string, figurantId: string) {
  const accessError = await requireStaffFigurantAccess(figurantId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();
  const { data: photo, error: readError } = await supabase
    .from("figurant_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (readError || !photo) return { error: "Photo introuvable." };

  const { error } = await supabase.from("figurant_photos").delete()
    .eq("id", photoId).eq("figurant_id", figurantId);
  if (error) return { error: error.message };
  const { error: storageError } = await supabase.storage.from("figurant-photos").remove([photo.storage_path]);
  if (storageError) console.warn("[deletePhoto] Fichier orphelin à nettoyer :", photoId);
  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

export async function deleteLien(lienId: string, figurantId: string) {
  const accessError = await requireStaffFigurantAccess(figurantId);
  if (accessError) return { error: accessError };
  const supabase = createAdminClient();
  const { error } = await supabase.from("figurant_liens").delete()
    .eq("id", lienId).eq("figurant_id", figurantId);
  if (error) return { error: error.message };
  revalidatePath(`/figurants/${figurantId}`);
  return { success: true as const };
}

// BUG-12 : la fusion s'exécute dans une SEULE transaction PostgreSQL.
// Une contrainte d'unicité (deux candidatures pour la même annonce, comptes
 // déjà actifs, etc.) fait échouer l'ensemble sans transfert partiel.
export async function mergeFigurants(keepId: string, mergeId: string) {
  if (!keepId || !mergeId || keepId === mergeId) {
    return { error: "Choisis deux profils différents." };
  }
  const actor = await getCurrentProfile();
  if (!actor?.isOwner) return { error: "Fusion réservée au compte propriétaire." };

  // The database function checks auth.uid() / owner again. Avoid using the
  // service-role client here, which bypasses the request identity.
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("merge_figurants_atomique", {
    p_keep_id: keepId,
    p_merge_id: mergeId,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "Fusion impossible : des données sont en conflit (candidatures, compte ou autres). Les deux profils sont conservés, sans perte d'historique." };
    }
    return { error: "Fusion non effectuée. Aucun transfert partiel : " + error.message };
  }

  revalidatePath("/figurants");
  revalidatePath("/candidatures");
  revalidatePath(`/figurants/${keepId}`);
  return { success: true as const };
}
