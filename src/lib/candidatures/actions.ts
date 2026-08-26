"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAge } from "@/lib/documents/fields";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { LIEN_BANDE_DEMO, MAX_PHOTOS_PAR_FIGURANT } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { countFigurantPhotos, insertFigurantPhoto } from "@/lib/figurants/photos";
import { createNotification } from "@/lib/notifications/create";
import { checkProjetAccess } from "@/lib/auth/session";
import type { Cachet } from "./types";

// candidatures n'a pas de projet_id direct — il vit sur son annonce.
async function checkCandidatureAccess(candidatureId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: candidature } = await supabase
    .from("candidatures")
    .select("annonce_id")
    .eq("id", candidatureId)
    .maybeSingle();
  if (!candidature) return null;
  const { data: annonce } = await supabase
    .from("annonces")
    .select("projet_id")
    .eq("id", candidature.annonce_id)
    .maybeSingle();
  if (!annonce) return null;
  return checkProjetAccess(annonce.projet_id);
}

export async function recordCandidatureMessage(
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "libre", email, subject, projetId });
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

export async function postulerAnnonce(
  publicToken: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const prenom = str(formData, "prenom");
  const nom = str(formData, "nom");
  const email = str(formData, "email");
  const telephone = str(formData, "telephone");
  const ville = str(formData, "ville");
  const adresse = str(formData, "adresse");
  const codePostal = str(formData, "code_postal");
  const communeNaissance = str(formData, "commune_naissance");
  const dateNaissance = str(formData, "date_naissance");
  const message = str(formData, "message");
  const lienBandeDemo = str(formData, "lien_bande_demo");
  const tailleCm = num(formData, "taille_cm");
  const poidsKg = num(formData, "poids_kg");
  const pointure = num(formData, "pointure");
  const veste = str(formData, "veste");
  const pantalon = str(formData, "pantalon");
  const temporaire = formData.get("temporaire") === "on";
  const aVehiculeRaw = str(formData, "a_vehicule");
  const vehiculeMarque = str(formData, "vehicule_marque");
  const vehiculeVelo = formData.get("vehicule_velo") === "on";
  const vehiculeMoto = formData.get("vehicule_moto") === "on";
  const vehiculeScooter = formData.get("vehicule_scooter") === "on";

  if (!prenom || !nom || !email || !telephone || !ville) {
    return { error: "Tous les champs de contact sont obligatoires." };
  }
  if (!adresse || !codePostal) {
    return { error: "L'adresse de résidence complète (rue et code postal) est obligatoire." };
  }
  if (!dateNaissance) {
    return { error: "La date de naissance est obligatoire." };
  }
  if (!communeNaissance) {
    return { error: "La commune de naissance est obligatoire." };
  }
  if (!message) {
    return { error: "Le message est obligatoire." };
  }
  if (!tailleCm || !poidsKg || !pointure) {
    return { error: "Les mensurations (taille, poids, pointure) sont obligatoires." };
  }
  if (!veste || !pantalon) {
    return { error: "Les tailles de veste et de pantalon sont obligatoires." };
  }
  const photoPortrait = formData.get("photo_portrait");
  const photoPied = formData.get("photo_pied");
  const photoSelfie = formData.get("photo_selfie");
  if (
    !(photoPortrait instanceof File && photoPortrait.size > 0) ||
    !(photoPied instanceof File && photoPied.size > 0) ||
    !(photoSelfie instanceof File && photoSelfie.size > 0)
  ) {
    return { error: "Les 3 photos (portrait, pied, selfie) sont obligatoires." };
  }
  if (!str(formData, "selfie_date")) {
    return { error: "La date du selfie est obligatoire." };
  }
  if (aVehiculeRaw !== "oui" && aVehiculeRaw !== "non") {
    return { error: "Merci d'indiquer si tu as un véhicule." };
  }
  const aVehicule = aVehiculeRaw === "oui";
  if (aVehicule) {
    if (!vehiculeVelo && !vehiculeMoto && !vehiculeScooter) {
      return { error: "Merci de préciser le type de véhicule (vélo, moto ou scooter)." };
    }
    if (!vehiculeMarque) {
      return { error: "La marque du véhicule est obligatoire." };
    }
  }

  const age = computeAge(dateNaissance);
  if (age === null || age < 0 || age > 120) {
    return { error: "Date de naissance invalide." };
  }

  const supabase = createAdminClient();

  const { data: annonce, error: annonceError } = await supabase
    .from("annonces")
    .select("id, titre, projet_id, statut, ouverte_mineurs, limite_candidatures, bande_demo_obligatoire")
    .eq("public_token", publicToken)
    .single();

  if (annonceError || !annonce) {
    return { error: "Cette annonce n'existe plus." };
  }
  if (annonce.statut !== "ouverte") {
    return { error: "Cette annonce n'accepte plus de candidatures." };
  }
  if (age < 16 && !annonce.ouverte_mineurs) {
    return { error: "Cette annonce n'est pas ouverte aux candidats de moins de 16 ans." };
  }
  if (annonce.bande_demo_obligatoire && !lienBandeDemo) {
    return { error: "Le lien de la bande démo est obligatoire pour cette annonce." };
  }
  if (annonce.limite_candidatures !== null) {
    const { count } = await supabase
      .from("candidatures")
      .select("id", { count: "exact", head: true })
      .eq("annonce_id", annonce.id);
    if ((count ?? 0) >= annonce.limite_candidatures) {
      return { error: "Cette annonce a atteint son nombre maximum de candidatures." };
    }
  }

  const [{ data: questions }, { data: annonceDates }] = await Promise.all([
    supabase.from("annonce_questions").select("id").eq("annonce_id", annonce.id),
    supabase.from("annonce_dates").select("id").eq("annonce_id", annonce.id),
  ]);

  for (const q of questions ?? []) {
    if (!str(formData, `question_${q.id}`)) {
      return { error: "Merci de répondre à toutes les questions." };
    }
  }
  for (const d of annonceDates ?? []) {
    if (!str(formData, `date_${d.id}`)) {
      return { error: "Merci d'indiquer ta disponibilité pour toutes les dates proposées." };
    }
  }

  const { data: existingFigurant } = await supabase
    .from("figurants")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let figurantId = existingFigurant?.id as string | undefined;

  // Même sans email identique, on considère que c'est la même personne si
  // le nom et le téléphone correspondent déjà à une fiche existante (1
  // email = 1 fiche, mais une personne ne doit pas se retrouver dupliquée
  // juste parce qu'elle a postulé avec une autre adresse).
  if (!figurantId) {
    const telephoneNormalise = telephone.replace(/\s+/g, "");
    const { data: memeNom } = await supabase.from("figurants").select("id, telephone").ilike("nom", nom);
    const doublon = (memeNom ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
    if (doublon) figurantId = doublon.id;
  }

  if (!figurantId) {
    const { data: newFigurant, error: figurantError } = await supabase
      .from("figurants")
      .insert({
        prenom,
        nom,
        email,
        telephone,
        ville,
        adresse,
        code_postal: codePostal,
        commune_naissance: communeNaissance,
        date_naissance: dateNaissance,
        taille_cm: tailleCm,
        poids_kg: poidsKg,
        pointure,
        veste,
        pantalon,
        temporaire,
        temporaire_projet_id: temporaire ? annonce.projet_id : null,
        a_vehicule: aVehicule,
        vehicule_velo: vehiculeVelo,
        vehicule_moto: vehiculeMoto,
        vehicule_scooter: vehiculeScooter,
        vehicule_marque: vehiculeMarque,
      })
      .select("id")
      .single();

    if (figurantError) {
      if (figurantError.code === "23505") {
        return { error: "Un profil existe déjà avec cet email. Contactez le casting si besoin." };
      }
      return { error: figurantError.message };
    }
    figurantId = newFigurant.id;
  } else {
    // Fiche existante : on rafraîchit les mensurations et le véhicule avec
    // ce qui vient d'être saisi/confirmé sur cette candidature.
    await supabase
      .from("figurants")
      .update({
        ville,
        adresse,
        code_postal: codePostal,
        commune_naissance: communeNaissance,
        taille_cm: tailleCm,
        poids_kg: poidsKg,
        pointure,
        veste,
        pantalon,
        a_vehicule: aVehicule,
        vehicule_velo: vehiculeVelo,
        vehicule_moto: vehiculeMoto,
        vehicule_scooter: vehiculeScooter,
        vehicule_marque: vehiculeMarque,
      })
      .eq("id", figurantId);
  }

  // On n'écrase le lien existant que si un nouveau a été fourni — sinon un
  // candidat qui repostule sans le ressaisir (formulaire pas pré-rempli, pas
  // connecté) ne doit pas effacer celui déjà enregistré sur sa fiche.
  if (lienBandeDemo) {
    await upsertFigurantLienByLabel(supabase, figurantId!, LIEN_BANDE_DEMO, lienBandeDemo);
  }

  const { data: candidature, error: candidatureError } = await supabase
    .from("candidatures")
    .insert({
      figurant_id: figurantId,
      annonce_id: annonce.id,
      message,
      date_naissance: dateNaissance,
    })
    .select("id")
    .single();

  if (candidatureError || !candidature) {
    if (candidatureError?.code === "23505") {
      return { error: "Tu as déjà postulé à cette annonce avec cet email." };
    }
    return { error: candidatureError?.message ?? "Erreur inconnue." };
  }

  const reponses = (questions ?? []).map((q) => ({
    candidature_id: candidature.id,
    annonce_question_id: q.id,
    reponse: str(formData, `question_${q.id}`) === "oui",
  }));
  if (reponses.length > 0) await supabase.from("candidature_reponses").insert(reponses);

  const disponibilites = (annonceDates ?? []).map((d) => ({
    candidature_id: candidature.id,
    annonce_date_id: d.id,
    disponible: str(formData, `date_${d.id}`) === "oui",
  }));
  if (disponibilites.length > 0) await supabase.from("candidature_disponibilites").insert(disponibilites);

  await uploadCandidaturePhotos(figurantId!, formData);

  await createNotification("candidature", `${prenom} ${nom} a postulé à ${annonce.titre}`, {
    figurantId,
    projetId: annonce.projet_id,
    lien: `/candidatures/${candidature.id}`,
  });

  revalidatePath("/candidatures");
  return { success: true };
}

async function uploadCandidaturePhotos(figurantId: string, formData: FormData) {
  const supabase = createAdminClient();
  const selfieDate = str(formData, "selfie_date") ?? new Date().toISOString().slice(0, 10);

  const files: { file: File; type: "portrait" | "pied" | "selfie" | "autre" | "vehicule"; priseLe?: string | null }[] =
    [];
  const portrait = formData.get("photo_portrait");
  if (portrait instanceof File && portrait.size > 0) files.push({ file: portrait, type: "portrait" });
  const pied = formData.get("photo_pied");
  if (pied instanceof File && pied.size > 0) files.push({ file: pied, type: "pied" });
  const selfie = formData.get("photo_selfie");
  if (selfie instanceof File && selfie.size > 0) files.push({ file: selfie, type: "selfie", priseLe: selfieDate });
  const vehicule = formData.get("photo_vehicule");
  if (vehicule instanceof File && vehicule.size > 0) files.push({ file: vehicule, type: "vehicule" });
  for (const extra of formData.getAll("photo_extra")) {
    if (extra instanceof File && extra.size > 0) files.push({ file: extra, type: "autre" });
  }

  let remaining = MAX_PHOTOS_PAR_FIGURANT - (await countFigurantPhotos(supabase, figurantId));
  for (const { file, type, priseLe } of files) {
    if (remaining <= 0) break;
    const result = await insertFigurantPhoto(supabase, figurantId, type, file, { priseLe });
    if (!result.error) remaining -= 1;
  }
}

// Ne touche jamais onglet_id — c'est OngletPicker (setCandidatureOnglet) qui
// s'en charge, séparément, pour ne pas écraser le rangement à chaque
// sauvegarde de fonction/cachet.
export async function updateCandidature(id: string, formData: FormData) {
  const accessError = await checkCandidatureAccess(id);
  if (accessError) throw new Error(accessError);

  const fonction_assignee = str(formData, "fonction_assignee");
  const cachet_assigne = str(formData, "cachet_assigne") as Cachet | null;

  const supabase = createAdminClient();
  await supabase.from("candidatures").update({ fonction_assignee, cachet_assigne }).eq("id", id);

  revalidatePath("/candidatures");
}

// Rangement pur — ne crée jamais de booking ni n'active l'accès au compte.
// Le seul déclencheur de ces deux effets est le transfert réel vers une
// journée (voir createBookingFromDrop).
export async function setCandidatureOnglet(id: string, ongletId: string | null) {
  const accessError = await checkCandidatureAccess(id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase.from("candidatures").update({ onglet_id: ongletId }).eq("id", id);
  revalidatePath("/candidatures");
  if (error) return { error: error.message };
  return { success: true as const };
}

export async function setCandidaturesOngletBulk(ids: string[], ongletId: string | null) {
  if (ids.length === 0) return { success: true as const };
  const supabase = createAdminClient();

  const { data: candidatures } = await supabase.from("candidatures").select("annonce_id").in("id", ids);
  const annonceIds = Array.from(new Set((candidatures ?? []).map((c) => c.annonce_id)));
  if (annonceIds.length > 0) {
    const { data: annonces } = await supabase.from("annonces").select("projet_id").in("id", annonceIds);
    const projetIds = Array.from(new Set((annonces ?? []).map((a) => a.projet_id)));
    for (const projetId of projetIds) {
      const accessError = await checkProjetAccess(projetId);
      if (accessError) return { error: accessError };
    }
  }

  const { error } = await supabase.from("candidatures").update({ onglet_id: ongletId }).in("id", ids);
  revalidatePath("/candidatures");
  if (error) return { error: error.message };
  return { success: true as const };
}

export async function createCandidatureOnglet(nom: string) {
  const trimmed = nom.trim();
  if (!trimmed) return { error: "Nom d'onglet requis." };

  const supabase = createAdminClient();
  const { data: existant } = await supabase
    .from("candidature_onglets")
    .select("id")
    .ilike("nom", trimmed)
    .maybeSingle();
  if (existant) return { onglet: existant };

  const { data: maxOrdre } = await supabase
    .from("candidature_onglets")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: onglet, error } = await supabase
    .from("candidature_onglets")
    .insert({ nom: trimmed, couleur: "default", fixe: false, ordre: (maxOrdre?.ordre ?? 0) + 1 })
    .select("id, nom, couleur, fixe, ordre")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return { onglet };
}

export async function deleteCandidatureOnglet(id: string) {
  const supabase = createAdminClient();
  const { data: onglet } = await supabase.from("candidature_onglets").select("fixe").eq("id", id).single();
  if (onglet?.fixe) return { error: "Cet onglet ne peut pas être supprimé." };

  await supabase.from("candidature_onglets").delete().eq("id", id);
  revalidatePath("/candidatures");
  return { success: true as const };
}
