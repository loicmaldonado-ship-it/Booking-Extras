"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAge } from "@/lib/documents/fields";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { activerAccesCompte } from "@/lib/candidats/actions";
import { createFigurantSession } from "@/lib/candidats/session";
import { LIEN_BANDE_DEMO, MAX_PHOTOS_PAR_FIGURANT } from "@/lib/figurants/types";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { countFigurantPhotos, insertFigurantPhoto } from "@/lib/figurants/photos";
import { createNotification } from "@/lib/notifications/create";
import { checkProjetAccess } from "@/lib/auth/session";
import { getPhotosByFigurantId } from "@/lib/documents/data";
import { getTournagesConfirmesCount } from "./onglets";
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

  // Une candidature (annonce de figuration) ne doit matcher/rattacher
  // qu'une fiche figurant·e — jamais une éventuelle fiche comédien·ne
  // partageant le même email ou nom+téléphone (voir comedien-privacy.ts) :
  // celle-ci reste privée à son pool, et n'a pas à être mutée par ce flux
  // public.
  const { data: existingFigurant } = await supabase
    .from("figurants")
    .select("id")
    .ilike("email", email)
    .eq("est_comedien", false)
    .maybeSingle();

  let figurantId = existingFigurant?.id as string | undefined;

  // Même sans email identique, on considère que c'est la même personne si
  // le nom et le téléphone correspondent déjà à une fiche existante (1
  // email = 1 fiche, mais une personne ne doit pas se retrouver dupliquée
  // juste parce qu'elle a postulé avec une autre adresse).
  if (!figurantId) {
    const telephoneNormalise = telephone.replace(/\s+/g, "");
    const { data: memeNom } = await supabase
      .from("figurants")
      .select("id, telephone")
      .ilike("nom", nom)
      .eq("est_comedien", false);
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
        genre,
        pronom,
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
        ...(showAgent && !sansAgent
          ? { agent_nom: agentNom, agent_email: agentEmail, agent_telephone: agentTelephone, agent_agence: agentAgence }
          : {}),
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
        genre,
        pronom,
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
        ...(showAgent && !sansAgent
          ? { agent_nom: agentNom, agent_email: agentEmail, agent_telephone: agentTelephone, agent_agence: agentAgence }
          : {}),
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
    annonceId: annonce.id,
    lien: `/candidatures/${candidature.id}`,
  });

  // Accès à l'espace personnel activé dès la candidature, plus besoin
  // d'attendre une validation côté staff (déjà idempotent + envoie déjà
  // l'email "espace prêt" avec lien magique) — puis connexion immédiate,
  // pour proposer un mot de passe sans détour par cet email.
  await activerAccesCompte(figurantId!, annonce.projet_id);
  await createFigurantSession(figurantId!);

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
  if (ongletId) {
    const ongletError = await checkOngletMatchesAnnonces(ongletId, [id]);
    if (ongletError) return { error: ongletError };
  }
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

  if (ongletId) {
    const ongletError = await checkOngletMatchesAnnonces(ongletId, ids);
    if (ongletError) return { error: ongletError };
  }

  const { error } = await supabase.from("candidatures").update({ onglet_id: ongletId }).in("id", ids);
  revalidatePath("/candidatures");
  if (error) return { error: error.message };
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
// ceux posés par la migration (Retenu, Peut-être, Ok dispo, OUT BE).
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
      "id, onglet_id, message, created_at, figurants(id, prenom, nom, ville, code_postal, genre, date_naissance, taille_cm, poids_kg, pointure, veste, pantalon, a_vehicule, vehicule_velo, vehicule_moto, vehicule_scooter, compte_myrole)"
    )
    .eq("id", id)
    .single<{
      id: string;
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
        compte_myrole: boolean;
      } | null;
    }>();
  if (!c?.figurants) return { error: "Candidature introuvable." };
  const f = c.figurants;

  const [photosByFigurant, { data: reponses }, { data: dispos }, { data: lien }, tournages] = await Promise.all([
    getPhotosByFigurantId([f.id]),
    supabase
      .from("candidature_reponses")
      .select("reponse, annonce_questions(label)")
      .eq("candidature_id", id)
      .returns<{ reponse: boolean; annonce_questions: { label: string } | null }[]>(),
    supabase
      .from("candidature_disponibilites")
      .select("disponible, annonce_dates(date)")
      .eq("candidature_id", id)
      .returns<{ disponible: boolean; annonce_dates: { date: string } | null }[]>(),
    supabase.from("figurant_liens").select("url").eq("figurant_id", f.id).eq("label", LIEN_BANDE_DEMO).maybeSingle(),
    getTournagesConfirmesCount([f.id]),
  ]);

  const rank = (type: string) => {
    const i = PHOTO_ORDER.indexOf(type);
    return i === -1 ? PHOTO_ORDER.length : i;
  };
  const photos = (photosByFigurant.get(f.id) ?? [])
    .filter((p): p is typeof p & { url: string } => !!p.url)
    .sort((a, b) => rank(a.type) - rank(b.type))
    .map((p) => ({ url: p.url, type: p.type }));

  const vehicule =
    f.a_vehicule === null
      ? null
      : f.a_vehicule
        ? [f.vehicule_velo && "vélo", f.vehicule_moto && "moto", f.vehicule_scooter && "scooter"].filter(Boolean).join(", ") ||
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
      dates: (dispos ?? [])
        .filter((d) => d.annonce_dates)
        .map((d) => ({ date: d.annonce_dates!.date, disponible: d.disponible }))
        .sort((a, b) => a.date.localeCompare(b.date)),
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
