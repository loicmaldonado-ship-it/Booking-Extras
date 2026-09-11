"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { compressVideo, formatSecondsRemaining } from "@/lib/media/compress-video";
import { translateUploadErrorMessage } from "@/lib/media/upload-error";
import { logCastingUploadEvent } from "@/lib/casting/upload-actions";

type SlotResult = { bucket?: string; path?: string; token?: string; error?: string };

// Logique partagée par le formulaire candidat (casting-upload-form.tsx) et
// la carte équipe (casting-entry-manage-card.tsx) — les deux ont eu besoin
// des mêmes correctifs séparément cette semaine (blocage compression,
// "Envoi..." qui ne se débloquait pas) car ils réimplémentaient chacun la
// même mécanique. Centralisée ici pour qu'un futur correctif s'applique
// aux deux d'un coup, et pour tracer chaque tentative (voir
// logCastingUploadEvent) plutôt que de repartir de zéro sur un signalement
// sans détail.
export async function compressAndUploadVideo({
  file,
  signal,
  onProgress,
  createSlot,
  logContext,
}: {
  file: File;
  signal: AbortSignal;
  onProgress: (label: string) => void;
  createSlot: () => Promise<SlotResult>;
  logContext: { source: "candidat" | "equipe"; entryId?: string; requestToken?: string };
}): Promise<string> {
  const startedAt = Date.now();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;

  // Budget de compression proportionné à la durée RÉELLE de la vidéo (connue
  // dès les premières lignes de compressVideo, voir onDurationKnown) plutôt
  // qu'un délai fixe deviné à l'aveugle — assez large pour ne jamais couper
  // une compression saine mais longue (la méthode de repli "temps réel" est
  // liée à la durée de lecture, jusqu'à 2 passes), assez strict pour ne pas
  // laisser un vrai blocage tourner indéfiniment. Tant que la durée n'est
  // pas encore connue (fichier très gros à parser, lecture initiale lente),
  // un filet de sécurité de 40s s'applique — resitué dès que la vraie durée
  // arrive.
  //
  // Vraie Promise.race, pas juste un AbortSignal transmis à compressVideo :
  // les blocages signalés cette semaine venaient justement d'un await
  // natif (video.play(), recorder.stop()...) qui ne réagit pas forcément à
  // un signal d'annulation. Se contenter de compter sur la coopération
  // interne reproduirait exactement ce même défaut — ici, même si
  // compressVideo ne se règle jamais, cette fonction avance quand même une
  // fois le budget dépassé.
  const compressionController = new AbortController();
  let budgetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolveBudget: (() => void) | null = null;
  const budgetPromise = new Promise<void>((resolve) => {
    resolveBudget = resolve;
  });
  function scheduleBudget(seconds: number) {
    if (budgetTimeoutId) clearTimeout(budgetTimeoutId);
    const budgetMs = Math.max(30_000, seconds * 1000 * 3 + 20_000);
    budgetTimeoutId = setTimeout(() => {
      compressionController.abort(); // best-effort, au cas où compressVideo écoute à ce point précis
      resolveBudget?.();
    }, budgetMs);
  }
  scheduleBudget(40);
  const userAbortPromise = new Promise<void>((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });

  let compressed: File = file;
  let outcome: "reussi" | "repli_original" | "erreur" | "annule" = "reussi";
  let compressionErrorMessage: string | undefined;
  const compressionPromise = compressVideo(file, {
    signal: compressionController.signal,
    onDurationKnown: scheduleBudget,
    onProgress: (pct, secondsRemaining, pass) => {
      const phase = pass === 2 ? " (2e passe)" : "";
      const eta = secondsRemaining !== undefined ? ` (${formatSecondsRemaining(secondsRemaining)})` : "";
      onProgress(`Compression...${phase} ${pct}%${eta}`);
    },
  });
  try {
    const winner = await Promise.race([
      compressionPromise.then((f) => ({ kind: "done" as const, file: f })),
      budgetPromise.then(() => ({ kind: "timeout" as const })),
      userAbortPromise.then(() => ({ kind: "aborted" as const })),
    ]);
    if (winner.kind === "aborted") {
      compressionController.abort(); // best-effort, au cas où compressVideo écoute à ce point précis
      compressionPromise.catch(() => {}); // évite un "unhandled rejection" si ça se règle après coup
      throw new DOMException("Annulé", "AbortError");
    }
    if (winner.kind === "timeout") {
      compressed = file;
      outcome = "repli_original";
      // Si compressVideo finit par se régler après coup (rejet suite à
      // l'abort ci-dessus, ou résultat qu'on n'utilisera plus), on évite un
      // avertissement "unhandled rejection" dans la console sans rien
      // changer au résultat déjà décidé.
      compressionPromise.catch(() => {});
    } else {
      compressed = winner.file;
    }
  } catch (e) {
    if (signal.aborted) throw e; // annulation utilisateur réelle — on relance telle quelle
    // Erreur interne échappée de compressVideo (rare : il gère déjà la
    // quasi-totalité de ses cas en interne) — repli sur le fichier
    // d'origine, jamais un échec bloquant.
    compressed = file;
    outcome = "erreur";
    compressionErrorMessage = e instanceof Error ? e.message : String(e);
  } finally {
    if (budgetTimeoutId) clearTimeout(budgetTimeoutId);
  }

  onProgress("Envoi...");
  // Même course que déjà éprouvée sur les deux surfaces : le SDK Supabase
  // n'accepte pas de signal d'annulation sur uploadToSignedUrl, donc sans
  // cette course contre un timeout + le signal d'annulation, "Annuler" ne
  // ferait rigoureusement rien tant que l'appel réseau ne se règle pas de
  // lui-même.
  try {
    const attempt = (async () => {
      const target = await createSlot();
      if (target.error || !target.bucket || !target.path || !target.token) {
        throw new Error(target.error ?? "Impossible de préparer l'envoi.");
      }
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, compressed, { contentType: compressed.type });
      if (uploadError) throw new Error(translateUploadErrorMessage(uploadError.message));
      return target.path;
    })();
    const path = await new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(
        () => reject(new Error("L'envoi prend trop de temps — vérifie ta connexion et réessaie.")),
        120_000
      );
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          reject(new DOMException("Annulé", "AbortError"));
        },
        { once: true }
      );
      attempt.then((p) => {
        clearTimeout(timeoutId);
        resolve(p);
      }, reject);
    });

    await logCastingUploadEvent({
      ...logContext,
      kind: "video",
      outcome,
      errorMessage: compressionErrorMessage,
      originalBytes: file.size,
      finalBytes: compressed.size,
      durationMs: Date.now() - startedAt,
      userAgent,
    });
    return path;
  } catch (e) {
    await logCastingUploadEvent({
      ...logContext,
      kind: "video",
      outcome: e instanceof DOMException && e.name === "AbortError" ? "annule" : "erreur",
      errorMessage: e instanceof Error ? e.message : String(e),
      originalBytes: file.size,
      finalBytes: compressed.size,
      durationMs: Date.now() - startedAt,
      userAgent,
    });
    throw e;
  }
}
