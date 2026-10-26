"use server";

import { nomComplet } from "@/lib/noms";
import type { FicheCasting } from "./fiche";
import type { ReponseCasting } from "./types";
import { GENRES } from "@/lib/figurants/types";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";
import { createNotification } from "@/lib/notifications/create";
import { castingPhotoPathValid, castingVideoPathValid, isCastingSubmissionLocked } from "./upload-paths";

type EntryWithRole = {
  id: string;
  projet_id: string;
  figurant_id: string;
  statut: string;
  submitted_at: string | null;
  casting_roles: {
    nom: string;
    nb_videos: number;
    photo_labels: string[];
    demande_bande_demo: boolean;
    date_limite_envoi: string | null;
    questions: string[];
  } | null;
  figurants: { prenom: string; nom: string } | null;
};

async function loadEntry(requestToken: string): Promise<EntryWithRole | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_entries")
    .select(
      "id, projet_id, figurant_id, statut, submitted_at, casting_roles(nom, nb_videos, photo_labels, demande_bande_demo, date_limite_envoi, questions), figurants(prenom, nom)"
    )
    .eq("request_token", requestToken)
    .maybeSingle<EntryWithRole>();
  return data;
}

// Vérifié à chaque étape (préparation d'un slot d'upload ET finalisation) —
// pas seulement affiché côté page, qui peut être restée ouverte depuis
// avant la deadline ou contournée directement via les Server Actions.
function deadlinePassed(role: EntryWithRole["casting_roles"]): boolean {
  const dateLimite = role?.date_limite_envoi;
  if (!dateLimite) return false;
  return dateLimite < new Date().toISOString().slice(0, 10);
}

// Trace une tentative d'envoi vidéo (candidat OU équipe) pour ne plus
// repartir de zéro quand quelqu'un signale "ça marche pas" sans détail —
// voir la migration casting_upload_events. Best-effort strict : un souci
// ici ne doit jamais faire échouer l'envoi réel, donc on avale toute
// erreur silencieusement. Accepte soit `entryId` (équipe, déjà connu côté
// composant) soit `requestToken` (candidat, qui ne connaît que son lien).
export async function logCastingUploadEvent(input: {
  entryId?: string;
  requestToken?: string;
  source: "candidat" | "equipe";
  kind: "video" | "photo";
  outcome: "reussi" | "repli_original" | "erreur" | "annule";
  errorMessage?: string;
  originalBytes?: number;
  finalBytes?: number;
  durationMs?: number;
  userAgent?: string;
}): Promise<void> {
  try {
    // Server Actions are public endpoints. Never trust a client-supplied
    // entry ID as proof of staff authorization.
    if (!input ||
        !["candidat", "equipe"].includes(input.source) ||
        !["video", "photo"].includes(input.kind) ||
        !["reussi", "repli_original", "erreur", "annule"].includes(input.outcome)) return;

    const supabase = createAdminClient();
    let entryId: string;
    let projetId: string;

    if (input.source === "equipe") {
      // Staff must be authenticated AND a member of this casting's project.
      if (typeof input.entryId !== "string" || input.requestToken) return;
      const { data: entry } = await supabase.from("casting_entries")
        .select("id, projet_id")
        .eq("id", input.entryId)
        .maybeSingle<{ id: string; projet_id: string }>();
      if (!entry || await checkProjetAccess(entry.projet_id)) return;
      entryId = entry.id;
      projetId = entry.projet_id;
    } else {
      // Candidates only have a single-entry bearer link, never staff rights.
      if (typeof input.requestToken !== "string" || input.entryId) return;
      const entry = await loadEntry(input.requestToken);
      if (!entry) return;
      entryId = entry.id;
      projetId = entry.projet_id;
    }

    const safeMetric = (value: number | undefined, max: number): number | null =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;

    await supabase.from("casting_upload_events").insert({
      entry_id: entryId,
      projet_id: projetId,
      source: input.source,
      kind: input.kind,
      outcome: input.outcome,
      error_message: typeof input.errorMessage === "string" ? input.errorMessage.slice(0, 500) : null,
      original_bytes: safeMetric(input.originalBytes, 5_000_000_000_000),
      final_bytes: safeMetric(input.finalBytes, 5_000_000_000_000),
      duration_ms: safeMetric(input.durationMs, 2_147_483_647),
      user_agent: typeof input.userAgent === "string" ? input.userAgent.slice(0, 300) : null,
    });
  } catch (e) {
    console.warn("[logCastingUploadEvent] Échec de l'enregistrement (sans impact sur l'envoi).", e);
  }
}

// Génère une URL d'upload signée pour UN fichier précis (une vidéo n°X, ou
// la photo d'un libellé donné) — le navigateur du candidat envoie ensuite
// le fichier DIRECTEMENT à Supabase Storage avec cette URL, sans repasser
// par la fonction serveur Vercel. Sans ça, une vidéo volumineuse transitait
// navigateur -> fonction serveur -> Storage, et dépassait le temps
// d'exécution maximum de la fonction sur mobile/réseau lent — d'où l'échec
// "This page couldn't load" au moment d'envoyer.
export async function createCastingUploadSlot(
  requestToken: string,
  kind: "video" | "photo",
  slot: string
): Promise<{ bucket?: string; path?: string; token?: string; error?: string }> {
  const entry = await loadEntry(requestToken);
  if (!entry) return { error: "Ce lien n'est plus valide." };
  if (deadlinePassed(entry.casting_roles)) return { error: "La date limite d'envoi est passée." };
  if (isCastingSubmissionLocked(entry)) return { error: "Ce casting a déjà été transmis ou clôturé." };

  const role = entry.casting_roles;
  if (kind === "video") {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 0 || index >= (role?.nb_videos ?? 1)) {
      return { error: "Créneau vidéo invalide." };
    }
  } else if (!role?.photo_labels.includes(slot)) {
    return { error: "Créneau photo invalide." };
  }

  const bucket = kind === "video" ? "casting-videos" : "figurant-photos";
  const ext = kind === "video" ? "mp4" : "jpg";
  const path =
    kind === "video"
      ? `${entry.figurant_id}/${entry.id}-video-${slot}-${crypto.randomUUID()}.${ext}`
      : `${entry.figurant_id}/casting-${entry.id}-${encodeURIComponent(slot)}-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Impossible de préparer l'envoi." };

  return { bucket, path: data.path, token: data.token };
}

// Appelée une fois tous les fichiers déjà envoyés directement à Storage
// (voir createCastingUploadSlot) : ne reçoit que des chemins, jamais de
// fichier — payload minuscule, aucun risque de timeout ici.
export async function finalizeCastingUpload(
  requestToken: string,
  payload: {
    videoPaths: string[];
    photos: { label: string; path: string }[];
    bandeDemo?: string;
    fiche?: FicheCasting;
    reponses?: ReponseCasting[];
  }
): Promise<{ error?: string; success?: boolean }> {
  const entry = await loadEntry(requestToken);
  if (!entry) return { error: "Ce lien n'est plus valide." };
  if (deadlinePassed(entry.casting_roles)) return { error: "La date limite d'envoi est passée." };
  if (isCastingSubmissionLocked(entry)) return { error: "Ce casting a déjà été transmis ou clôturé." };

  const role = entry.casting_roles;
  const nbVideos = role?.nb_videos ?? 1;
  const labels = role?.photo_labels ?? [];
  if (!payload || !Array.isArray(payload.videoPaths) || !Array.isArray(payload.photos)) {
    return { error: "Fichiers de casting invalides." };
  }
  if (nbVideos > 0 && payload.videoPaths.length === 0) {
    return { error: "Au moins une vidéo est obligatoire." };
  }
  if (payload.videoPaths.length > nbVideos || payload.photos.length !== labels.length) {
    return { error: "Nombre de fichiers de casting invalide." };
  }
  if (new Set(payload.videoPaths).size !== payload.videoPaths.length ||
      payload.videoPaths.some((path) => !castingVideoPathValid(path, entry.figurant_id, entry.id, nbVideos))) {
    return { error: "Chemin vidéo non autorisé." };
  }
  if (new Set(payload.photos.map((photo) => photo?.label)).size !== payload.photos.length ||
      payload.photos.some((photo) => !photo || !labels.includes(photo.label) ||
        !castingPhotoPathValid(photo.path, entry.figurant_id, entry.id, photo.label))) {
    return { error: "Chemin photo non autorisé." };
  }

  const supabase = createAdminClient();
  // Check presence of all files before writing any business data. Storage
  // signed-upload URLs and paths must not be taken as proof of upload.
  for (const path of payload.videoPaths) {
    const { error } = await supabase.storage.from("casting-videos").info(path);
    if (error) return { error: "La vidéo n'a pas été retrouvée dans le stockage." };
  }
  for (const photo of payload.photos) {
    const { error } = await supabase.storage.from("figurant-photos").info(photo.path);
    if (error) return { error: "La photo n'a pas été retrouvée dans le stockage." };
  }

  for (const photo of payload.photos) {
    const { error } = await supabase.from("figurant_photos").insert({
      figurant_id: entry.figurant_id,
      type: "casting",
      storage_path: photo.path,
      projet_id: entry.projet_id,
      casting_entry_id: entry.id,
      label: photo.label,
    });
    if (error) return { error: error.message };
  }

  // Fiche complétée par la personne (naissance, mensurations…) : seules les
  // valeurs plausibles sont gardées, les champs vides ne touchent à rien.
  if (payload.fiche) {
    const f = payload.fiche;
    const nombre = (v: number | null, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
    const texte = (v: string | null, max = 60) => (v && v.trim() ? v.trim().slice(0, max) : undefined);
    const maj: Record<string, string | number> = {};
    if (f.date_naissance && /^\d{4}-\d{2}-\d{2}$/.test(f.date_naissance) && f.date_naissance < new Date().toISOString().slice(0, 10)) {
      maj.date_naissance = f.date_naissance;
    }
    if (f.genre && GENRES.includes(f.genre as (typeof GENRES)[number])) maj.genre = f.genre;
    const cp = texte(f.code_postal, 10);
    if (cp) maj.code_postal = cp;
    const ville = texte(f.ville, 80);
    if (ville) maj.ville = ville;
    const taille = nombre(f.taille_cm, 50, 250);
    if (taille !== undefined) maj.taille_cm = Math.round(taille);
    const poids = nombre(f.poids_kg, 10, 300);
    if (poids !== undefined) maj.poids_kg = Math.round(poids);
    const pointure = nombre(f.pointure, 15, 60);
    if (pointure !== undefined) maj.pointure = pointure;
    const veste = texte(f.veste, 20);
    if (veste) maj.veste = veste;
    const pantalon = texte(f.pantalon, 20);
    if (pantalon) maj.pantalon = pantalon;
    if (Object.keys(maj).length > 0) {
      const { error: errFiche } = await supabase.from("figurants").update(maj).eq("id", entry.figurant_id);
      if (errFiche) return { error: `Ta fiche n'a pas pu être enregistrée : ${errFiche.message}` };
    }
  }

  if (role?.demande_bande_demo && payload.bandeDemo?.trim()) {
    await upsertFigurantLienByLabel(supabase, entry.figurant_id, LIEN_BANDE_DEMO, payload.bandeDemo.trim());
  }

  // "À traiter" se met tout seul dès que tout est envoyé — jamais
  // "Complet" directement, ça reste un choix du staff une fois relu. Ne
  // fait jamais régresser un statut déjà avancé à la main (ex. si le staff
  // a déjà relancé ou validé avant un renvoi via ce même lien).
  // Réponses aux questions du rôle : une par question, oui / non.
  const questions = role?.questions ?? [];
  const reponses: ReponseCasting[] = [];
  for (const question of questions) {
    const r = (payload.reponses ?? []).find((x) => x.question === question);
    if (!r || (r.reponse !== "oui" && r.reponse !== "non")) return { error: "Réponds à toutes les questions." };
    reponses.push({ question, reponse: r.reponse, precision: r.precision?.trim().slice(0, 200) || null });
  }

  const patch: {
    video_storage_paths: string[];
    submitted_at: string;
    statut?: "envoyé";
    reponses?: ReponseCasting[];
  } = {
    video_storage_paths: payload.videoPaths,
    submitted_at: new Date().toISOString(),
  };
  if (questions.length > 0) patch.reponses = reponses;
  if (entry.statut === "proposé") patch.statut = "envoyé";

  const { data: finalized, error } = await supabase.from("casting_entries")
    .update(patch)
    .eq("id", entry.id)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!finalized) return { error: "Ce casting a déjà été transmis." };

  if (entry.figurants) {
    await createNotification(
      "casting",
      `${nomComplet(entry.figurants)} a envoyé sa vidéo/photos pour « ${role?.nom ?? "casting"} »`,
      { figurantId: entry.figurant_id, projetId: entry.projet_id, lien: "/casting" }
    );
  }

  revalidatePath("/casting");
  return { success: true };
}
