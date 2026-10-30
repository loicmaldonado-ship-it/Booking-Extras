"use client";

import { logCastingUploadEvent } from "@/lib/casting/upload-actions";

// Envoi d'une vidéo : le fichier d'origine part tel quel, directement du
// navigateur vers le stockage (aucune compression, aucune attente avant
// l'envoi), avec une vraie progression, une reprise automatique si le réseau
// coupe et une annulation immédiate. Partagé par le formulaire candidat et
// la carte équipe.

export type SlotResult = { bucket?: string; path?: string; token?: string; error?: string };

export type Progression = {
  // 0–100
  pct: number;
  // Secondes restantes estimées (null tant qu'on ne peut pas les estimer).
  restant: number | null;
  // Nouvel essai en cours après une coupure réseau.
  essai: number;
};

// Au-delà, on refuse tout de suite plutôt que d'envoyer des minutes pour
// rien (la limite réelle du stockage est réglée côté Supabase).
export const VIDEO_MAX_OCTETS = 2 * 1024 * 1024 * 1024;

const ESSAIS_MAX = 3;
// Pas un seul octet parti depuis ce délai : connexion coupée ou bloquée.
const BLOCAGE_MS = 45_000;

export function formatTaille(octets: number): string {
  if (octets >= 1024 ** 3) return `${(octets / 1024 ** 3).toFixed(1)} Go`;
  if (octets >= 1024 ** 2) return `${Math.round(octets / 1024 ** 2)} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export function formatRestant(secondes: number): string {
  if (secondes < 60) return `~${Math.max(1, Math.round(secondes))} s`;
  const minutes = Math.round(secondes / 60);
  return minutes < 60 ? `~${minutes} min` : `~${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

class ErreurEnvoi extends Error {
  constructor(
    message: string,
    readonly reessayable: boolean
  ) {
    super(message);
  }
}

function messageServeur(status: number, corps: string): ErreurEnvoi {
  let detail = "";
  try {
    const json = JSON.parse(corps) as { message?: string; error?: string };
    detail = json.message ?? json.error ?? "";
  } catch {
    detail = corps.slice(0, 200);
  }
  if (status === 413 || /exceeded the maximum allowed size|too large|payload/i.test(detail)) {
    return new ErreurEnvoi(
      "Le site refuse cette vidéo : elle est plus lourde que la taille maximale réglée sur le stockage. Préviens l'équipe technique.",
      false
    );
  }
  const reessayable = status >= 500 || status === 408 || status === 429;
  return new ErreurEnvoi(detail ? `Envoi refusé (${detail}).` : `Envoi refusé (erreur ${status}).`, reessayable);
}

// Un essai : PUT du fichier brut vers l'URL signée, avec progression.
function envoyerUneFois(
  slot: Required<Pick<SlotResult, "bucket" | "path" | "token">>,
  file: File,
  signal: AbortSignal,
  onProgress: (envoyes: number, total: number, debut: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !cle) {
      reject(new ErreurEnvoi("Envoi impossible : configuration manquante.", false));
      return;
    }
    const chemin = `${slot.bucket}/${slot.path.split("/").map(encodeURIComponent).join("/")}`;
    const url = `${base}/storage/v1/object/upload/sign/${chemin}?token=${encodeURIComponent(slot.token)}`;
    const xhr = new XMLHttpRequest();
    const debut = Date.now();
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    function armer() {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        xhr.abort();
        reject(new ErreurEnvoi("La connexion semble coupée.", true));
      }, BLOCAGE_MS);
    }
    function fin() {
      if (minuteur) clearTimeout(minuteur);
      signal.removeEventListener("abort", surAnnulation);
    }
    function surAnnulation() {
      fin();
      xhr.abort();
      reject(new DOMException("Annulé", "AbortError"));
    }

    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", cle);
    xhr.setRequestHeader("Authorization", `Bearer ${cle}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      armer();
      if (e.lengthComputable) onProgress(e.loaded, e.total, debut);
    };
    xhr.onload = () => {
      fin();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(messageServeur(xhr.status, xhr.responseText));
    };
    xhr.onerror = () => {
      fin();
      reject(new ErreurEnvoi("Connexion perdue pendant l'envoi.", true));
    };
    xhr.ontimeout = xhr.onerror;

    if (signal.aborted) {
      reject(new DOMException("Annulé", "AbortError"));
      return;
    }
    signal.addEventListener("abort", surAnnulation, { once: true });
    armer();
    xhr.send(file);
  });
}

// Envoie la vidéo et renvoie son chemin dans le stockage. Reprend toute
// seule (3 essais) après une coupure réseau.
export async function envoyerVideo({
  file,
  signal,
  onProgress,
  createSlot,
  logContext,
}: {
  file: File;
  signal: AbortSignal;
  onProgress: (p: Progression) => void;
  createSlot: () => Promise<SlotResult>;
  logContext: { source: "candidat" | "equipe"; entryId?: string; requestToken?: string };
}): Promise<string> {
  const debutTotal = Date.now();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  const journal = async (outcome: "reussi" | "erreur" | "annule", errorMessage?: string) => {
    try {
      await logCastingUploadEvent({
        ...logContext,
        kind: "video",
        outcome,
        errorMessage,
        originalBytes: file.size,
        finalBytes: file.size,
        durationMs: Date.now() - debutTotal,
        userAgent,
      });
    } catch {
      // A failed logging request must never retry or change the upload result.
    }
  };

  if (file.size > VIDEO_MAX_OCTETS) {
    const message = `Cette vidéo fait ${formatTaille(file.size)} : le maximum est ${formatTaille(VIDEO_MAX_OCTETS)}.`;
    await journal("erreur", message);
    throw new Error(message);
  }

  let derniere: Error | null = null;
  for (let essai = 1; essai <= ESSAIS_MAX; essai++) {
    try {
      const slot = await createSlot();
      if (slot.error || !slot.bucket || !slot.path || !slot.token) {
        throw new ErreurEnvoi(slot.error ?? "Impossible de préparer l'envoi.", false);
      }
      onProgress({ pct: 0, restant: null, essai });
      await envoyerUneFois({ bucket: slot.bucket, path: slot.path, token: slot.token }, file, signal, (envoyes, total, debut) => {
        const ecoule = (Date.now() - debut) / 1000;
        const vitesse = ecoule > 1 ? envoyes / ecoule : 0;
        onProgress({
          pct: Math.min(99, Math.floor((envoyes / total) * 100)),
          restant: vitesse > 0 ? (total - envoyes) / vitesse : null,
          essai,
        });
      });
      onProgress({ pct: 100, restant: 0, essai });
      await journal("reussi");
      return slot.path;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        await journal("annule");
        throw e;
      }
      derniere = e instanceof Error ? e : new Error(String(e));
      const reessayable = e instanceof ErreurEnvoi ? e.reessayable : true;
      if (!reessayable || essai === ESSAIS_MAX) break;
      // Petite pause avant de reprendre, interrompue par une annulation.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, essai * 2000);
        signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
      });
      if (signal.aborted) {
        await journal("annule");
        throw new DOMException("Annulé", "AbortError");
      }
    }
  }
  const message = derniere?.message || "Échec de l'envoi.";
  await journal("erreur", message);
  throw new Error(message);
}

// Une fois la vidéo rattachée à un profil : demande son allègement en
// arrière-plan côté serveur (ffmpeg). Sans effet visible, jamais bloquant :
// si ça n'aboutit pas, une tâche planifiée rattrape.
export function declencherAllegement(path: string): void {
  try {
    fetch("/api/videos/alleger", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignoré
  }
}
