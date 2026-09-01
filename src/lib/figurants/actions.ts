"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { countFigurantPhotos, insertFigurantPhoto, MAX_PHOTOS_PAR_FIGURANT } from "./photos";
import { upsertAgent } from "@/lib/agents/actions";
import type { Civilite, Genre, PhotoType, Pronom } from "./types";

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
  const payload = buildFigurantPayload(formData);
  const fieldsError = requireBaseFields(payload);
  if (fieldsError) return { error: fieldsError };

  const portrait = formData.get("photo_portrait");
  const hasPortrait = portrait instanceof File && portrait.size > 0;
  if (!payload.est_comedien && !hasPortrait) {
    return { error: "Une photo portrait est obligatoire." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("figurants")
    .insert({ ...payload, confirme: true })
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
    if (photoError) return { error: photoError };
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

export async function updateFigurant(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const payload = buildFigurantPayload(formData);
  const fieldsError = requireBaseFields(payload);
  if (fieldsError) return { error: fieldsError };

  const supabase = createAdminClient();
  const { error } = await supabase.from("figurants").update(payload).eq("id", id);

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
  redirect(`/figurants/${id}`);
}

// Édition rapide de l'agent depuis n'importe où (ex. la carte casting) —
// sans repasser par le grand formulaire /modifier. L'agent est rattaché à
// la fiche, pas à une entrée de casting précise : le modifier ici le met à
// jour partout où ce profil apparaît.
export async function updateFigurantAgent(
  figurantId: string,
  formData: FormData
): Promise<{ error?: string; success?: true }> {
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

export async function deleteFigurant(id: string) {
  const supabase = createAdminClient();
  await supabase.from("figurants").delete().eq("id", id);
  revalidatePath("/figurants");
  redirect("/figurants");
}

// Suppression depuis le panneau "doublons potentiels" — bloquée si le
// profil a la moindre candidature/booking/essayage associé, pour ne jamais
// effacer un historique réel par erreur.
export async function supprimerFigurantDoublon(figurantId: string) {
  const supabase = createAdminClient();
  const [{ count: candidaturesCount }, { count: bookingsCount }, { count: essayagesCount }] = await Promise.all([
    supabase.from("candidatures").select("id", { count: "exact", head: true }).eq("figurant_id", figurantId),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("figurant_id", figurantId),
    supabase.from("essayages").select("id", { count: "exact", head: true }).eq("figurant_id", figurantId),
  ]);

  if ((candidaturesCount ?? 0) > 0 || (bookingsCount ?? 0) > 0 || (essayagesCount ?? 0) > 0) {
    return {
      error: "Ce profil a des candidatures, bookings ou essayages associés — suppression bloquée par sécurité.",
    };
  }

  await supabase.from("figurants").delete().eq("id", figurantId);
  revalidatePath("/figurants");
  return { success: true as const };
}

// Une photo à la fois : un lot de plusieurs photos de téléphone dans une
// seule requête peut dépasser ce que le parseur multipart de Next.js/Node
// encaisse ("Failed to parse body as FormData"), même sous la limite de
// taille configurée. Un fichier par appel reste largement sous ce seuil.
export async function uploadFigurantPhoto(figurantId: string, _prevState: unknown, formData: FormData) {
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
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("figurant_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  if (photo) {
    await supabase.storage.from("figurant-photos").remove([photo.storage_path]);
  }
  await supabase.from("figurant_photos").delete().eq("id", photoId);
  revalidatePath(`/figurants/${figurantId}`);
}

export async function deleteLien(lienId: string, figurantId: string) {
  const supabase = createAdminClient();
  await supabase.from("figurant_liens").delete().eq("id", lienId);
  revalidatePath(`/figurants/${figurantId}`);
}

// Fusionne deux fiches détectées comme doublons possibles (même personne
// candidatée sous un pseudo/coordonnées différentes) : tout l'historique de
// mergeId est réattaché à keepId, puis mergeId est supprimé. Ne fusionne
// jamais deux candidatures de la même annonce (contrainte figurant_id +
// annonce_id) : dans ce cas le doublon est supprimé plutôt que réattaché.
export async function mergeFigurants(keepId: string, mergeId: string) {
  if (keepId === mergeId) return { error: "Impossible de fusionner un profil avec lui-même." };

  const supabase = createAdminClient();

  const [{ data: keep }, { data: merge }] = await Promise.all([
    supabase.from("figurants").select("confirme, acces_compte").eq("id", keepId).single(),
    supabase.from("figurants").select("confirme, acces_compte").eq("id", mergeId).single(),
  ]);
  if (!keep || !merge) return { error: "Profil introuvable." };

  const { data: keepCandidatures } = await supabase.from("candidatures").select("annonce_id").eq("figurant_id", keepId);
  const keepAnnonceIds = new Set((keepCandidatures ?? []).map((c) => c.annonce_id));

  const { data: mergeCandidatures } = await supabase.from("candidatures").select("id, annonce_id").eq("figurant_id", mergeId);
  for (const c of mergeCandidatures ?? []) {
    if (keepAnnonceIds.has(c.annonce_id)) {
      await supabase.from("candidatures").delete().eq("id", c.id);
    } else {
      await supabase.from("candidatures").update({ figurant_id: keepId }).eq("id", c.id);
    }
  }

  const otherTables = ["bookings", "essayages", "figurant_messages", "figurant_photos", "figurant_liens"];
  for (const table of otherTables) {
    await supabase.from(table).update({ figurant_id: keepId }).eq("figurant_id", mergeId);
  }

  // Ne jamais faire perdre confirme/acces_compte à la fiche conservée si
  // l'autre les avait déjà.
  const patch: { confirme?: boolean; acces_compte?: boolean } = {};
  if (merge.confirme && !keep.confirme) patch.confirme = true;
  if (merge.acces_compte && !keep.acces_compte) patch.acces_compte = true;
  if (Object.keys(patch).length > 0) {
    await supabase.from("figurants").update(patch).eq("id", keepId);
  }

  await supabase.from("figurants").delete().eq("id", mergeId);

  revalidatePath("/figurants");
  revalidatePath("/candidatures");
  revalidatePath(`/figurants/${keepId}`);
  return { success: true as const };
}
