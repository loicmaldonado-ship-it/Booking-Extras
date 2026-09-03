"use client";

import { compressVideoWebCodecs } from "./webcodecs-compress-video";

export function formatSecondsRemaining(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, seconds)}s`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes}min`;
}

type CompressVideoOpts = {
  maxWidth?: number;
  targetBytes?: number;
  hardCapBytes?: number;
  maxBitsPerSecond?: number;
  minBitsPerSecond?: number;
  maxDurationSeconds?: number;
  // secondsRemaining est une estimation (basée sur la position de lecture
  // dans la passe en cours, à vitesse 1x pour la méthode temps réel) —
  // utile pour afficher un temps d'attente plutôt qu'un pourcentage
  // abstrait. `pass` ne concerne que la méthode temps réel (1 ou 2 passes).
  onProgress?: (pct: number, secondsRemaining?: number, pass?: 1 | 2) => void;
  // Permet d'annuler une compression en cours (bouton "Annuler" côté
  // appelant) — lève une DOMException("AbortError") plutôt que de replier
  // silencieusement sur le fichier d'origine : une annulation explicite de
  // l'utilisateur ne doit jamais se retrouver à envoyer quand même.
  signal?: AbortSignal;
};

// Tente d'abord la voie rapide (WebCodecs, voir webcodecs-compress-video.ts)
// qui décode/réencode directement sans être bridée à la durée réelle de la
// vidéo — mais seulement pour un MP4/MOV, sur un navigateur qui supporte
// WebCodecs, avec des pistes dont la config s'extrait proprement. Dès que
// l'une de ces conditions manque (ou que quoi que ce soit y échoue), on
// retombe sur la méthode temps réel ci-dessous (canvas + MediaRecorder),
// déjà éprouvée sur Safari — jamais de régression, seulement une perte de
// vitesse dans les cas où la voie rapide ne s'applique pas.
//
// Désactivée sur Safari pour l'instant : plusieurs signalements réels de
// blocage (99%, puis 0% après le correctif de contre-pression) malgré
// plusieurs correctifs successifs — le décodeur semble tout simplement ne
// jamais produire de sortie sur certaines vidéos, avant même le filet de
// sécurité (timeout). Plutôt que de continuer à corriger à l'aveugle sans
// accès à Safari pour déboguer, on retombe directement sur la méthode
// temps réel (plus lente mais fiable) pour ce navigateur — jamais essayé,
// jamais bloqué.
const isSafari =
  typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export async function compressVideo(file: File, opts?: CompressVideoOpts): Promise<File> {
  if (!file.type.startsWith("video/")) return file;
  if (opts?.signal?.aborted) throw new DOMException("Annulé", "AbortError");

  if (!isSafari) {
    const resolvedOpts = {
      maxWidth: opts?.maxWidth ?? 1152,
      targetBytes: opts?.targetBytes ?? 18_000_000,
      hardCapBytes: opts?.hardCapBytes ?? 40_000_000,
      maxBitsPerSecond: opts?.maxBitsPerSecond ?? 1_800_000,
      minBitsPerSecond: opts?.minBitsPerSecond ?? 80_000,
      maxDurationSeconds: opts?.maxDurationSeconds ?? 1800,
      audioBitsPerSecond: 96_000,
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    };

    const fast = await compressVideoWebCodecs(file, resolvedOpts);
    if (fast) return fast;
  }

  return compressVideoRealtime(file, opts);
}

async function compressVideoRealtime(
  file: File,
  opts?: {
    maxWidth?: number;
    targetBytes?: number;
    hardCapBytes?: number;
    maxBitsPerSecond?: number;
    minBitsPerSecond?: number;
    maxDurationSeconds?: number;
    onProgress?: (pct: number, secondsRemaining?: number, pass?: 1 | 2) => void;
    signal?: AbortSignal;
  }
): Promise<File> {
  if (opts?.signal?.aborted) throw new DOMException("Annulé", "AbortError");
  if (typeof MediaRecorder === "undefined") {
    console.warn("[compressVideo] MediaRecorder indisponible sur ce navigateur — envoi du fichier original.");
    return file;
  }
  if (typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) {
    console.warn("[compressVideo] canvas.captureStream indisponible sur ce navigateur — envoi du fichier original.");
    return file;
  }

  const maxWidth = opts?.maxWidth ?? 1152;
  // Marge sous la limite réelle du stockage (~50 Mo, vérifié) — volontai-
  // rement large car certains navigateurs ne respectent qu'à peu près le
  // débit demandé (voir deuxième passe plus bas, filet de sécurité final).
  const targetBytes = opts?.targetBytes ?? 18_000_000;
  // Plafond dur : si même la deuxième passe dépasse ça, on considère que
  // ce navigateur ne sait pas piloter sa taille de sortie et on tente
  // quand même l'envoi avec ce qu'on a (toujours bien plus petit que
  // l'original) plutôt que de boucler indéfiniment.
  const hardCapBytes = opts?.hardCapBytes ?? 40_000_000;
  const maxBitsPerSecond = opts?.maxBitsPerSecond ?? 1_800_000;
  // Plancher volontairement bas : avec la piste audio réservée en plus,
  // ce plancher garantit qu'une vidéo même à la durée maximale autorisée
  // reste sous la limite de stockage (quitte à perdre en qualité plutôt
  // qu'en échec d'envoi).
  const minBitsPerSecond = opts?.minBitsPerSecond ?? 80_000;
  const audioBitsPerSecond = 96_000;
  // Filet de sécurité contre une sélection aberrante (film entier par
  // erreur) plutôt qu'une vraie limite métier — un selftape, même long,
  // reste très en dessous.
  const maxDurationSeconds = opts?.maxDurationSeconds ?? 1800;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  // .muted (pas juste volume = 0) : Safari applique sa politique
  // d'autoplay sur cette propriété précise, surtout après un await avant
  // .play() (voir plus bas) qui peut faire perdre le geste utilisateur
  // sur ce navigateur — sans ça, .play() est silencieusement bloqué et la
  // compression échoue en repli sur le fichier d'origine. Le flux capturé
  // reste inchangé (le contenu décodé, pas la sortie audio de l'appareil).
  video.muted = true;
  video.volume = 0;

  // Safari ne respecte qu'approximativement le débit demandé à
  // MediaRecorder (voir deuxième passe plus bas) — dépasser largement la
  // cible dès la première passe y est fréquent, et la deuxième passe double
  // alors l'attente (toute la vidéo est rejouée une deuxième fois). En
  // visant délibérément plus bas dès la première passe sur ce navigateur,
  // on évite la plupart de ces deuxièmes passes — Chrome/Firefox, dont le
  // débit de sortie est fiable, gardent la pleine qualité calculée.
  // (isSafari est défini plus haut dans le fichier, réutilisé ici.)

  let intervalId = 0;
  const audioCtxRef: { current: AudioContext | null } = { current: null };

  // Piste audio à recombiner avec le canvas — calculée une seule fois et
  // réutilisée sur les deux passes (createMediaElementSource ne peut être
  // appelé qu'une fois par <video>, sinon le navigateur lève une erreur).
  function getAudioTracks(): MediaStreamTrack[] {
    const videoWithCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const nativeTracks = videoWithCapture.captureStream?.().getAudioTracks() ?? [];
    if (nativeTracks.length > 0) return nativeTracks;

    // Safari ne supporte pas HTMLMediaElement.captureStream (même sur les
    // versions récentes) — on tape l'audio décodé via Web Audio API à la
    // place, qui fonctionne partout. .muted n'empêche pas la capture ici :
    // une fois relié au graphe Web Audio, l'élément arrête de sortir
    // directement vers les haut-parleurs (rien à couper côté audible),
    // seul ce qu'on connecte explicitement (ici rien) est entendu.
    try {
      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return [];
      audioCtxRef.current = new AudioContextCtor();
      const source = audioCtxRef.current.createMediaElementSource(video);
      const dest = audioCtxRef.current.createMediaStreamDestination();
      source.connect(dest);
      console.warn("[compressVideo] video.captureStream indisponible (Safari ?) — repli Web Audio API pour la piste audio.");
      return dest.stream.getAudioTracks();
    } catch (audioErr) {
      console.warn("[compressVideo] Repli audio Web Audio API a échoué — compression sans son.", audioErr);
      return [];
    }
  }

  // Une passe d'enregistrement complète (rejoue la vidéo du début à la
  // fin) à une résolution/un débit donnés — appelée une ou deux fois.
  async function recordPass(
    width: number,
    height: number,
    videoBitsPerSecond: number,
    audioTracks: MediaStreamTrack[],
    passIndex: 1 | 2
  ): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[compressVideo] Contexte canvas 2D indisponible.");
      return null;
    }

    // 15 im/s sur Safari (au lieu de 30) : dessiner le canvas ET encoder
    // deux fois moins souvent réduit d'autant la charge processeur pendant
    // toute la passe — un utilisateur a eu le navigateur entier figé
    // (page entièrement bloquée, même le bouton Annuler) sur une vidéo
    // réelle de 108s, probablement la vraie vidéo/le vrai codec saturant
    // le fil principal là où nos clips de test synthétiques ne le
    // faisaient pas.
    const fps = isSafari ? 15 : 30;
    const canvasStream = canvas.captureStream(fps);
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
    if (audioTracks.length === 0) {
      console.warn("[compressVideo] Aucune piste audio disponible — compression sans son.");
    }

    // Liste large de variantes, plusieurs navigateurs (Safari en tête)
    // n'acceptent qu'une écriture précise du mimeType pour isTypeSupported.
    const mimeType = [
      "video/mp4;codecs=avc1",
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm;codecs=h264",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) {
      console.warn("[compressVideo] Aucun format d'enregistrement supporté par MediaRecorder.");
      return null;
    }

    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const recordingDone = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    // setInterval plutôt que requestAnimationFrame : sur mobile, l'appli
    // passe souvent en arrière-plan pendant une compression de plusieurs
    // minutes (verrouillage d'écran, changement d'appli) — rAF s'arrête
    // alors complètement (image figée), setInterval continue à tourner
    // (au pire ralenti), donc la vidéo produite reste correcte.
    function drawFrame() {
      if (video.paused || video.ended) return;
      ctx!.drawImage(video, 0, 0, width, height);
    }
    // Toujours rapporté (les deux passes) — laisser la deuxième passe sans
    // retour, comme avant, donnait l'impression que la compression était
    // bloquée pendant plusieurs minutes alors qu'elle tournait toujours.
    video.ontimeupdate = () => {
      if (!video.duration) return;
      const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
      const secondsRemaining = Math.max(0, Math.round(video.duration - video.currentTime));
      opts?.onProgress?.(pct, secondsRemaining, passIndex);
    };

    video.currentTime = 0;
    recorder.start();
    await video.play();
    intervalId = window.setInterval(drawFrame, 1000 / fps);

    try {
      await new Promise<void>((resolve, reject) => {
        video.onended = () => resolve();
        opts?.signal?.addEventListener("abort", () => reject(new DOMException("Annulé", "AbortError")), { once: true });
        // Filet de sécurité : sur une vidéo réelle, currentTime peut
        // parfois rester bloqué juste avant duration sans jamais
        // déclencher "ended" — on considère la passe terminée après la
        // durée attendue + une marge plutôt que d'attendre indéfiniment.
        setTimeout(resolve, (video.duration + 5) * 1000);
      });
    } finally {
      clearInterval(intervalId);
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
    }

    const blob = await recordingDone;
    return blob.size > 0 ? blob : null;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Vidéo illisible."));
    });

    if (!video.duration || !Number.isFinite(video.duration) || video.duration > maxDurationSeconds) {
      console.warn(`[compressVideo] Durée invalide ou excessive (${video.duration}s) — envoi du fichier original.`);
      return file;
    }
    if (!video.videoWidth || !video.videoHeight) {
      console.warn("[compressVideo] Dimensions vidéo non lisibles — envoi du fichier original.");
      return file;
    }

    if (file.size <= targetBytes && video.videoWidth <= maxWidth) return file; // déjà dans le budget

    // Débit calculé pour tenir dans la taille cible sur toute la durée —
    // pas un chiffre fixe qui exploserait sur une vidéo longue.
    const rawVideoBitrate = (targetBytes * 8) / video.duration - audioBitsPerSecond;
    let videoBitsPerSecond = Math.round(Math.min(maxBitsPerSecond, Math.max(minBitsPerSecond, rawVideoBitrate)));
    // Vise 40% plus bas dès le départ sur Safari, pour éviter dans la
    // plupart des cas la deuxième passe (qui rejoue toute la vidéo une
    // deuxième fois — voir plus haut).
    if (isSafari) videoBitsPerSecond = Math.max(minBitsPerSecond, Math.round(videoBitsPerSecond * 0.6));
    // À très faible débit (vidéo longue), une résolution plus modeste
    // donne un meilleur rendu qu'une haute résolution trop compressée.
    // Sur Safari, plafond de résolution systématique en plus (pas
    // seulement à faible débit) — dessiner/encoder moins de pixels par
    // image réduit directement la charge processeur, indépendamment du
    // débit visé (voir fps plus bas pour la même raison).
    const effectiveMaxWidth = isSafari
      ? Math.min(maxWidth, 960)
      : videoBitsPerSecond <= 700_000
        ? Math.min(maxWidth, 854)
        : maxWidth;

    const scale = Math.min(1, effectiveMaxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    // Essai de lecture "à vide" avant de créer le graphe Web Audio (voir
    // getAudioTracks juste après) : sur Safari, brancher l'élément à un
    // AudioContext avant sa toute première lecture réussie fait perdre
    // l'exemption "lecture automatique autorisée si muet" — .play() est
    // ensuite refusé (NotAllowedError) pour les passes d'enregistrement
    // qui suivent. Une première lecture réussie AVANT de toucher au Web
    // Audio API évite ce piège.
    try {
      await video.play();
      video.pause();
      video.currentTime = 0;
    } catch (playErr) {
      console.warn("[compressVideo] Lecture initiale refusée par le navigateur — envoi du fichier original.", playErr);
      return file;
    }

    const audioTracks = getAudioTracks();

    let blob = await recordPass(width, height, videoBitsPerSecond, audioTracks, 1);
    if (!blob) return file;

    // Deuxième passe si le navigateur n'a pas respecté le débit demandé —
    // résolution divisée par deux et débit largement revu à la baisse.
    if (blob.size > hardCapBytes) {
      console.warn(
        `[compressVideo] Première passe encore trop lourde (${blob.size}o) — deuxième passe à résolution réduite.`
      );
      const retryBlob = await recordPass(
        Math.max(320, Math.round(width / 2)),
        Math.max(180, Math.round(height / 2)),
        Math.round(videoBitsPerSecond / 3),
        audioTracks,
        2
      );
      if (retryBlob && retryBlob.size < blob.size) blob = retryBlob;
    }

    opts?.onProgress?.(100);
    if (blob.size >= file.size) {
      console.warn(`[compressVideo] Sortie (${blob.size}o) pas plus légère que l'original (${file.size}o) — envoi du fichier original.`);
      return file;
    }
    if (blob.size > hardCapBytes) {
      console.warn(`[compressVideo] Sortie encore volumineuse (${blob.size}o) malgré la deuxième passe — envoi quand même.`);
    }

    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    return new File([blob], file.name.replace(/\.\w+$/, `.${ext}`), { type: blob.type });
  } catch (e) {
    // Une annulation explicite ne doit jamais se replier sur l'envoi du
    // fichier d'origine — l'utilisateur a demandé d'arrêter, pas de
    // continuer sans compression.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.warn("[compressVideo] Erreur pendant la compression — envoi du fichier original.", e);
    return file;
  } finally {
    clearInterval(intervalId);
    URL.revokeObjectURL(url);
    audioCtxRef.current?.close();
  }
}
