"use server";

import type { FicheCasting } from "./fiche";
import type { ReponseCasting } from "./types";
import { GENRES } from "@/lib/figurants/types";
import { validateImageUpload } from "@/lib/media/validate-upload";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
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
  if (typeof requestToken !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestToken)) return null;
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
  if ((kind !== "video" && kind !== "photo") || typeof slot !== "string") return { error: "Créneau de dépôt invalide." };
  const entry = await loadEntry(requestToken);
  if (!entry) return { error: "Ce lien n'est plus valide." };
  if (deadlinePassed(entry.casting_roles)) return { error: "La date limite d'envoi est passée." };
  if (isCastingSubmissionLocked(entry)) return { error: "Ce casting a déjà été transmis ou clôturé." };

  const role = entry.casting_roles;
  let normalizedSlot = slot;
  if (kind === "video") {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 0 || index >= (role?.nb_videos ?? 1)) {
      return { error: "Créneau vidéo invalide." };
    }
    normalizedSlot = String(index);
  } else if (!role?.photo_labels.includes(slot)) {
    return { error: "Créneau photo invalide." };
  }

  const bucket = kind === "video" ? "casting-videos" : "figurant-photos";
  const ext = kind === "video" ? "mp4" : "jpg";
  const path =
    kind === "video"
      ? `${entry.figurant_id}/${entry.id}-video-${normalizedSlot}-${crypto.randomUUID()}.${ext}`
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

  // Réponses aux questions du rôle : une par question, oui / non.
  if (payload.reponses !== undefined && !Array.isArray(payload.reponses)) return { error: "Réponses de casting invalides." };
  const questions = role?.questions ?? [];
  const reponses: ReponseCasting[] = [];
  for (const question of questions) {
    const r = (payload.reponses ?? []).find((x) => x && x.question === question);
    if (!r || (r.reponse !== "oui" && r.reponse !== "non")) return { error: "Réponds à toutes les questions." };
    reponses.push({ question, reponse: r.reponse, precision: typeof r.precision === "string" ? r.precision.trim().slice(0, 200) || null : null });
  }


  const supabase = createAdminClient();
  for (const path of payload.videoPaths) {
    const { error } = await supabase.storage.from("casting-videos").info(path);
    if (error) return { error: "La vidéo n'a pas été retrouvée dans le stockage." };
  }
  for (const photo of payload.photos) {
    const { data: blob, error } = await supabase.storage.from("figurant-photos").download(photo.path);
    if (error || !blob) return { error: "La photo n'a pas été retrouvée dans le stockage." };
    const validated = await validateImageUpload(new File([blob], "photo-casting", { type: blob.type }));
    if (validated.error) return { error: validated.error };
  }

  // Construire les seuls champs autorisés avant toute écriture. Le RPC les
  // revalide puis sauvegarde fiche, médias, réponses et notification ensemble.
  const maj: Record<string, string | number> = {};
  if (payload.fiche) {
    if (typeof payload.fiche !== "object" || Array.isArray(payload.fiche)) return { error: "Fiche de casting invalide." };
    const f = payload.fiche;
    const nombre = (v: unknown, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
    const texte = (v: unknown, max = 60) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
    if (typeof f.date_naissance === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.date_naissance) && f.date_naissance < new Date().toISOString().slice(0, 10)) maj.date_naissance = f.date_naissance;
    if (f.genre && GENRES.includes(f.genre as (typeof GENRES)[number])) maj.genre = f.genre;
    const cp = texte(f.code_postal, 10), ville = texte(f.ville, 80);
    if (cp) maj.code_postal = cp;
    if (ville) maj.ville = ville;
    const taille = nombre(f.taille_cm, 50, 250), poids = nombre(f.poids_kg, 10, 300), pointure = nombre(f.pointure, 15, 60);
    if (taille !== undefined) maj.taille_cm = Math.round(taille);
    if (poids !== undefined) maj.poids_kg = Math.round(poids);
    if (pointure !== undefined) maj.pointure = pointure;
    const veste = texte(f.veste, 20), pantalon = texte(f.pantalon, 20);
    if (veste) maj.veste = veste;
    if (pantalon) maj.pantalon = pantalon;
  }
  let demo: string | null = null;
  if (role?.demande_bande_demo && payload.bandeDemo !== undefined) {
    if (typeof payload.bandeDemo !== "string") return { error: "Lien de bande démo invalide." };
    if (payload.bandeDemo.trim()) {
      try {
        const url = new URL(payload.bandeDemo.trim());
        if (!["https:", "http:"].includes(url.protocol)) return { error: "Utilise un lien web pour ta bande démo." };
        demo = url.href;
      } catch { return { error: "Lien de bande démo invalide." }; }
    }
  }
  const { data: finalized, error } = await supabase.rpc("finaliser_casting_atomique", {
    p_token: requestToken,
    p_videos: payload.videoPaths,
    p_photos: payload.photos,
    p_profile: maj,
    p_demo: demo,
    p_reponses: reponses,
  });
  if (error) return { error: ["23514", "42501"].includes(error.code) ? error.message : "Ton envoi n’a pas pu être enregistré. Réessaie ; aucune réussite n’est confirmée." };
  if (finalized !== true) return { error: "Enregistrement non confirmé. Recharge le lien et réessaie." };
  revalidatePath("/casting");
  return { success: true };
}
