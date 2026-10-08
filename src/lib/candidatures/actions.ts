"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAge } from "@/lib/documents/fields";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { createFigurantSession, getCurrentFigurant } from "@/lib/candidats/session";
import { definirMotDePasse } from "@/lib/candidats/mot-de-passe";
import { emailMasque, MOT_DE_PASSE_MIN } from "@/lib/candidats/profil";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { createNotification } from "@/lib/notifications/create";
import { checkProjetAccess } from "@/lib/auth/session";
import { getPhotosByFigurantId, getPhotosParCandidature } from "@/lib/documents/data";
import { getTournagesConfirmesCount } from "./onglets";
import { appliquerMessagesOut, lireOngletsAvant } from "./out";
import type { Cachet, TriCandidature } from "./types";

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
): Promise<{ error?: string; success?: boolean; compteExistant?: boolean; compteCree?: boolean }> {
  // Compte obligatoire pour postuler : soit la personne est connectée, soit
  // elle crée son compte (mot de passe) en validant sa candidature.
  const session = await getCurrentFigurant();
  const prenom = str(formData, "prenom");
  const nom = str(formData, "nom");
  const email = str(formData, "email");
  const telephone = str(formData, "telephone");
  const ville = str(formData, "ville");
  const adresse = str(formData, "adresse");
  const codePostal = str(formData, "code_postal");
  const communeNaissance = str(formData, "commune_naissance");
  const dateNaissance = str(formData, "date_naissance");
  const genre = str(formData, "genre");
  const pronom = str(formData, "pronom");
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
  const vehiculeVoiture = formData.get("vehicule_voiture") === "on";
  const vehiculeVelo = formData.get("vehicule_velo") === "on";
  const vehiculeMoto = formData.get("vehicule_moto") === "on";
  const vehiculeScooter = formData.get("vehicule_scooter") === "on";
  const sansAgent = formData.get("sans_agent") === "on";
  const agentNom = str(formData, "agent_nom");
  const agentEmail = str(formData, "agent_email");
  const agentTelephone = str(formData, "agent_telephone");
  const agentAgence = str(formData, "agent_agence");

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
  if (!genre || !pronom) {
    return { error: "Le genre et le pronom sont obligatoires." };
  }
  if (!message) {
    return { error: "Le message est obligatoire." };
  }
  if (!tailleCm || !poidsKg || !pointure) {
    return { error: "Les mensurations (taille, poids, pointure) sont obligatoires." };
  }
  if (pointure < 15 || pointure > 60) {
    return { error: "La pointure doit être comprise entre 15 et 60." };
  }
  if (!veste || !pantalon) {
    return { error: "Les tailles de veste et de pantalon sont obligatoires." };
  }
  // Chaque photo obligatoire : un nouveau fichier, ou une photo déjà sur le
  // compte (« Mes photos », vérifiée plus bas).
  const photoFournie = (nom: string) => {
    const f = formData.get(nom);
    return (f instanceof File && f.size > 0) || !!str(formData, `${nom}__existante`);
  };
  if (!photoFournie("photo_portrait") || !photoFournie("photo_pied") || !photoFournie("photo_selfie")) {
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
    if (!vehiculeVoiture && !vehiculeVelo && !vehiculeMoto && !vehiculeScooter) {
      return { error: "Merci de préciser le type de véhicule (voiture, vélo, moto ou scooter)." };
    }
    if (!vehiculeMarque) {
      return { error: "La marque du véhicule est obligatoire." };
    }
  }

  const age = computeAge(dateNaissance);
  if (age === null || age < 0 || age > 120) {
    return { error: "Date de naissance invalide." };
  }

  const motDePasse = String(formData.get("password") ?? "");
  if (!session) {
    if (motDePasse.length < MOT_DE_PASSE_MIN) {
      return { error: `Crée ton mot de passe (au moins ${MOT_DE_PASSE_MIN} caractères) pour valider ta candidature.` };
    }
    if (motDePasse !== String(formData.get("password_confirmation") ?? "")) {
      return { error: "Les deux mots de passe ne sont pas identiques." };
    }
  }

  const supabase = createAdminClient();

  const { data: annonce, error: annonceError } = await supabase
    .from("annonces")
    .select("id, titre, projet_id, statut, ouverte_mineurs, limite_candidatures, bande_demo_obligatoire, types_cachet")
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
  const showAgent = (annonce.types_cachet as string[]).includes("Rôle");
  if (showAgent && !sansAgent && !agentNom) {
    return { error: "Merci de renseigner ton agent ou de cocher « Je n'ai pas d'agent »." };
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

  const champsProfil = {
    ville,
    adresse,
    code_postal: codePostal,
    commune_naissance: communeNaissance,
    genre,
    pronom,
    taille_cm: tailleCm,
    poids_kg: poidsKg,
    pointure,
    veste,
    pantalon,
    a_vehicule: aVehicule,
    vehicule_voiture: vehiculeVoiture,
    vehicule_velo: vehiculeVelo,
    vehicule_moto: vehiculeMoto,
    vehicule_scooter: vehiculeScooter,
    vehicule_marque: vehiculeMarque,
    ...(showAgent && !sansAgent
      ? { agent_nom: agentNom, agent_email: agentEmail, agent_telephone: agentTelephone, agent_agence: agentAgence }
      : {}),
  };

  let figurantId: string;
  let compteCree = false;
  if (session) {
    // Connecté·e : la candidature va sur son compte, quel que soit l'email
    // tapé ; la fiche est mise à jour avec ce qui vient d'être confirmé.
    figurantId = session.id;
    await supabase.from("figurants").update(champsProfil).eq("id", figurantId);
  } else {
    // Pas connecté·e : un email déjà connu (ou même nom + même téléphone) ne
    // se rattache jamais sans connexion — sinon n'importe qui pourrait
    // postuler, modifier la fiche et entrer dans l'espace d'un·e autre.
    // Fiches comédien·nes exclues (privées à leur pool, comedien-privacy.ts).
    const { data: memeEmail } = await supabase
      .from("figurants")
      .select("id")
      .ilike("email", email)
      .eq("est_comedien", false)
      .maybeSingle();
    if (memeEmail) {
      return {
        compteExistant: true,
        error:
          "Tu as déjà un compte avec cet email (tu as déjà postulé ou été booké·e). Connecte-toi pour valider ta candidature : tes infos seront remplies.",
      };
    }
    const telephoneNormalise = telephone.replace(/\s+/g, "");
    const { data: memeNom } = await supabase
      .from("figurants")
      .select("email, telephone")
      .ilike("nom", nom)
      .eq("est_comedien", false);
    const doublon = (memeNom ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
    if (doublon) {
      return {
        compteExistant: true,
        error: doublon.email
          ? `Un compte existe déjà à ton nom avec ce numéro, sous l'adresse ${emailMasque(doublon.email)}. Connecte-toi avec cette adresse pour valider ta candidature.`
          : "Un profil existe déjà à ton nom avec ce numéro. Contacte le casting pour le récupérer.",
      };
    }

    const { data: newFigurant, error: figurantError } = await supabase
      .from("figurants")
      .insert({
        ...champsProfil,
        prenom,
        nom,
        email: email.toLowerCase(),
        telephone,
        date_naissance: dateNaissance,
        temporaire,
        temporaire_projet_id: temporaire ? annonce.projet_id : null,
        acces_compte: true,
      })
      .select("id")
      .single();
    if (figurantError || !newFigurant) {
      if (figurantError?.code === "23505") {
        return { compteExistant: true, error: "Tu as déjà un compte avec cet email. Connecte-toi pour postuler." };
      }
      return { error: figurantError?.message ?? "Création du compte impossible." };
    }
    figurantId = newFigurant.id;
    const mdp = await definirMotDePasse(figurantId, motDePasse);
    if (mdp.error) {
      await supabase.from("figurants").delete().eq("id", figurantId);
      return { error: "Création du compte impossible, réessaie." };
    }
    compteCree = true;
    // Connecté·e tout de suite (accès activé à la création, sans l'email
    // « ajouté·e à une date de tournage », faux ici) : si la suite échoue,
    // un nouvel essai passe par le compte au lieu de « déjà un compte ».
    await createFigurantSession(figurantId);
  }

  // On n'écrase le lien existant que si un nouveau a été fourni — sinon un
  // candidat qui repostule sans le ressaisir (formulaire pas pré-rempli, pas
  // connecté) ne doit pas effacer celui déjà enregistré sur sa fiche.
  if (lienBandeDemo) {
    await upsertFigurantLienByLabel(supabase, figurantId, LIEN_BANDE_DEMO, lienBandeDemo);
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

  const photosResultat = await enregistrerPhotosCandidature(figurantId, candidature.id, formData);
  if (photosResultat.error) {
    // Candidature annulée (réponses et dispos suivent en cascade) : un
    // nouvel essai repart de zéro au lieu de « déjà postulé ».
    await supabase.from("candidatures").delete().eq("id", candidature.id);
    return { error: photosResultat.error };
  }

  await createNotification("candidature", `${prenom} ${nom} a postulé à ${annonce.titre}`, {
    figurantId,
    projetId: annonce.projet_id,
    annonceId: annonce.id,
    lien: `/candidatures/${candidature.id}`,
  });

  revalidatePath("/candidatures");
  return { success: true, compteCree };
}

// Photos d'une candidature : chaque emplacement reçoit soit un nouveau
// fichier (ajouté aussi à la photothèque du compte, sans limite — jamais
// ignoré), soit une photo déjà sur le compte (champ « <emplacement>__existante »,
// qui doit appartenir à ce compte). Le lien candidature ↔ photos est gardé
// dans candidature_photos.
async function enregistrerPhotosCandidature(
  figurantId: string,
  candidatureId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const selfieDate = str(formData, "selfie_date") ?? new Date().toISOString().slice(0, 10);
  const emplacements: { champ: string; type: "portrait" | "pied" | "selfie" | "vehicule" | "autre" }[] = [
    { champ: "photo_portrait", type: "portrait" },
    { champ: "photo_pied", type: "pied" },
    { champ: "photo_selfie", type: "selfie" },
    { champ: "photo_vehicule", type: "vehicule" },
    { champ: "photo_extra", type: "autre" },
  ];

  const existantes = emplacements.flatMap(({ champ, type }) =>
    formData
      .getAll(`${champ}__existante`)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((id) => ({ id, type }))
  );
  const { data: autorisees } =
    existantes.length > 0
      ? await supabase
          .from("figurant_photos")
          .select("id")
          .eq("figurant_id", figurantId)
          .in(
            "id",
            existantes.map((e) => e.id)
          )
      : { data: [] as { id: string }[] };
  const idsAutorises = new Set((autorisees ?? []).map((p) => p.id));

  const liens: { candidature_id: string; photo_id: string; emplacement: string; ordre: number }[] = [];
  const ajouter = (photoId: string, emplacement: string) => {
    if (liens.some((l) => l.photo_id === photoId)) return;
    liens.push({ candidature_id: candidatureId, photo_id: photoId, emplacement, ordre: liens.length });
  };

  for (const { champ, type } of emplacements) {
    for (const fichier of formData.getAll(champ)) {
      if (!(fichier instanceof File) || fichier.size === 0) continue;
      const res = await insertFigurantPhoto(supabase, figurantId, type, fichier, {
        priseLe: type === "selfie" ? selfieDate : null,
      });
      if (res.error || !res.id) return { error: `Une photo n'a pas pu être enregistrée (${res.error ?? "erreur"}). Réessaie.` };
      ajouter(res.id, type);
    }
    for (const e of existantes.filter((x) => x.type === type)) {
      if (idsAutorises.has(e.id)) ajouter(e.id, type);
    }
  }

  if (liens.length > 0) {
    const { error } = await supabase.from("candidature_photos").insert(liens);
    if (error) return { error: error.message };
  }
  return {};
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
  if (ongletId) {
    const ongletError = await checkOngletMatchesAnnonces(ongletId, [id]);
    if (ongletError) return { error: ongletError };
  }
  const avant = await lireOngletsAvant([id]);
  const { error } = await supabase.from("candidatures").update({ onglet_id: ongletId }).eq("id", id);
  revalidatePath("/candidatures");
  if (error) return { error: error.message };
  await appliquerMessagesOut(avant, ongletId);
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

  if (ongletId) {
    const ongletError = await checkOngletMatchesAnnonces(ongletId, ids);
    if (ongletError) return { error: ongletError };
  }

  const avant = await lireOngletsAvant(ids);
  const { error } = await supabase.from("candidatures").update({ onglet_id: ongletId }).in("id", ids);
  revalidatePath("/candidatures");
  if (error) return { error: error.message };
  await appliquerMessagesOut(avant, ongletId);
  return { success: true as const };
}

// Un onglet propre à une annonce ne peut ranger que des candidatures de
// cette annonce ; un onglet commun (annonce_id null) va partout.
async function checkOngletMatchesAnnonces(ongletId: string, candidatureIds: string[]): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: onglet } = await supabase
    .from("candidature_onglets")
    .select("annonce_id")
    .eq("id", ongletId)
    .maybeSingle();
  if (!onglet) return "Onglet introuvable.";
  if (!onglet.annonce_id) return null;
  const { data: candidatures } = await supabase.from("candidatures").select("annonce_id").in("id", candidatureIds);
  if ((candidatures ?? []).some((c) => c.annonce_id !== onglet.annonce_id)) {
    return "Cet onglet appartient à une autre annonce.";
  }
  return null;
}

// Créé sur l'annonce en cours, jamais en commun : les onglets communs sont
// ceux posés par la migration (Retenu, Peut-être, Ok dispo, OUT).
export async function createCandidatureOnglet(nom: string, annonceId: string) {
  const trimmed = nom.trim();
  if (!trimmed) return { error: "Nom d'onglet requis." };

  const supabase = createAdminClient();
  const { data: annonce } = await supabase.from("annonces").select("projet_id").eq("id", annonceId).maybeSingle();
  if (!annonce) return { error: "Annonce introuvable." };
  const accessError = await checkProjetAccess(annonce.projet_id);
  if (accessError) return { error: accessError };

  const { data: existant } = await supabase
    .from("candidature_onglets")
    .select("id")
    .ilike("nom", trimmed)
    .or(`annonce_id.is.null,annonce_id.eq.${annonceId}`)
    .limit(1)
    .maybeSingle();
  if (existant) return { onglet: existant };

  const { data: maxOrdre } = await supabase
    .from("candidature_onglets")
    .select("ordre")
    .lt("ordre", 99)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: onglet, error } = await supabase
    .from("candidature_onglets")
    .insert({ nom: trimmed, couleur: "default", fixe: false, ordre: (maxOrdre?.ordre ?? 0) + 1, annonce_id: annonceId })
    .select("id, nom, couleur, fixe, ordre, annonce_id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return { onglet };
}

const PHOTO_ORDER = ["portrait", "pied", "selfie", "tenue", "autre", "vehicule", "casting"];

export async function getCandidatureTriData(id: string): Promise<{ error?: string; data?: TriCandidature }> {
  const accessError = await checkCandidatureAccess(id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("candidatures")
    .select(
      "id, annonce_id, onglet_id, message, created_at, annonces(projet_id), figurants(id, prenom, nom, ville, code_postal, genre, date_naissance, taille_cm, poids_kg, pointure, veste, pantalon, a_vehicule, vehicule_voiture, vehicule_velo, vehicule_moto, vehicule_scooter, compte_myrole)"
    )
    .eq("id", id)
    .single<{
      id: string;
      annonce_id: string;
      annonces: { projet_id: string } | null;
      onglet_id: string | null;
      message: string | null;
      created_at: string;
      figurants: {
        id: string;
        prenom: string;
        nom: string;
        ville: string | null;
        code_postal: string | null;
        genre: string | null;
        date_naissance: string | null;
        taille_cm: number | null;
        poids_kg: number | null;
        pointure: number | null;
        veste: string | null;
        pantalon: string | null;
        a_vehicule: boolean | null;
        vehicule_velo: boolean;
        vehicule_moto: boolean;
        vehicule_scooter: boolean;
        vehicule_voiture: boolean;
        compte_myrole: boolean;
      } | null;
    }>();
  if (!c?.figurants) return { error: "Candidature introuvable." };
  const f = c.figurants;

  const [
    photosByFigurant,
    photosParCandidature,
    { data: reponses },
    { data: dispos },
    { data: lien },
    tournages,
    { data: annonceDates },
    { data: joursPrevus },
  ] = await Promise.all([
    getPhotosByFigurantId([f.id]),
    getPhotosParCandidature([id]),
    supabase
      .from("candidature_reponses")
      .select("reponse, annonce_questions(label)")
      .eq("candidature_id", id)
      .returns<{ reponse: boolean; annonce_questions: { label: string } | null }[]>(),
    supabase
      .from("candidature_disponibilites")
      .select("disponible, annonce_date_id")
      .eq("candidature_id", id),
    supabase.from("figurant_liens").select("url").eq("figurant_id", f.id).eq("label", LIEN_BANDE_DEMO).maybeSingle(),
    getTournagesConfirmesCount([f.id]),
    supabase.from("annonce_dates").select("id, date").eq("annonce_id", c.annonce_id).order("date"),
    supabase.from("candidature_jours").select("annonce_date_id").eq("candidature_id", id),
  ]);
  const { data: bookingsJours } =
    c.annonces && (annonceDates ?? []).length > 0
      ? await supabase
          .from("bookings")
          .select("date")
          .eq("projet_id", c.annonces.projet_id)
          .eq("figurant_id", f.id)
          .in("date", (annonceDates ?? []).map((d) => d.date))
      : { data: [] as { date: string }[] };
  const dispoByDate = new Map((dispos ?? []).map((d) => [d.annonce_date_id, d.disponible]));
  const prevus = new Set((joursPrevus ?? []).map((j) => j.annonce_date_id));
  const bookesLe = new Set((bookingsJours ?? []).map((b) => b.date));

  const rank = (type: string) => {
    const i = PHOTO_ORDER.indexOf(type);
    return i === -1 ? PHOTO_ORDER.length : i;
  };
  // Photos envoyées ou reprises pour cette annonce ; sinon celles du compte.
  const photos = (photosParCandidature.get(id) ?? photosByFigurant.get(f.id) ?? [])
    .filter((p): p is typeof p & { url: string } => !!p.url)
    .sort((a, b) => rank(a.type) - rank(b.type))
    .map((p) => ({ url: p.url, type: p.type }));

  const vehicule =
    f.a_vehicule === null
      ? null
      : f.a_vehicule
        ? [f.vehicule_voiture && "voiture", f.vehicule_velo && "vélo", f.vehicule_moto && "moto", f.vehicule_scooter && "scooter"].filter(Boolean).join(", ") ||
          "oui"
        : "non";

  return {
    data: {
      id: c.id,
      onglet_id: c.onglet_id,
      message: c.message,
      created_at: c.created_at,
      figurant: {
        id: f.id,
        prenom: f.prenom,
        nom: f.nom,
        ville: f.ville,
        code_postal: f.code_postal,
        genre: f.genre,
        age: computeAge(f.date_naissance),
        taille_cm: f.taille_cm,
        poids_kg: f.poids_kg,
        pointure: f.pointure,
        veste: f.veste,
        pantalon: f.pantalon,
        vehicule,
        compte_myrole: f.compte_myrole,
      },
      photos,
      questions: (reponses ?? [])
        .filter((r) => r.annonce_questions)
        .map((r) => ({ label: r.annonce_questions!.label, reponse: r.reponse })),
      jours: (annonceDates ?? []).map((d) => ({
        id: d.id,
        date: d.date,
        disponible: dispoByDate.get(d.id) ?? false,
        prevu: prevus.has(d.id),
        dansLaJournee: bookesLe.has(d.date),
      })),
      lienBandeDemo: lien?.url ?? null,
      tournagesConfirmes: tournages.get(f.id) ?? 0,
    },
  };
}

export async function deleteCandidatureOnglet(id: string) {
  const supabase = createAdminClient();
  const { data: onglet } = await supabase.from("candidature_onglets").select("fixe").eq("id", id).single();
  if (onglet?.fixe) return { error: "Cet onglet ne peut pas être supprimé." };

  await supabase.from("candidature_onglets").delete().eq("id", id);
  revalidatePath("/candidatures");
  return { success: true as const };
}
