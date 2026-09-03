"use client";

// Réduit une vidéo côté navigateur avant l'envoi, sans service payant ni
// librairie lourde (pas de ffmpeg.wasm) : on rejoue la vidéo dans un
// <video> caché, on redessine chaque image sur un canvas à une résolution
// plus raisonnable, et MediaRecorder réenregistre le tout à un débit
// calculé pour tenir sous une taille cible — piste audio d'origine
// recombinée au passage. Ça prend le temps de la vidéo elle-même
// (compression en temps réel), d'où le callback de progression pour
// afficher un état d'attente clair.
//
// Le débit vidéo est calculé à partir de la durée réelle (taille cible ÷
// durée) plutôt que fixé une fois pour toutes : une vidéo de 10-15 min
// avec un débit fixe dépasserait quand même la limite de stockage, alors
// qu'un débit adapté à sa durée reste dans le budget quelle que soit la
// longueur. Mais certains navigateurs (Safari en tête) ne respectent
// qu'approximativement le débit demandé à MediaRecorder — la première
// passe peut donc rester au-dessus de la cible malgré le calcul. Une
// deuxième passe, à résolution divisée par deux et débit largement revu à
// la baisse, rattrape ce cas plutôt que d'envoyer un fichier toujours
// trop gros.
//
// Toujours "fail-open" : navigateur trop ancien, format non supporté,
// vidéo aberrante (plusieurs heures), ou n'importe quelle erreur en cours
// de route -> on renvoie le fichier d'origine plutôt que de bloquer
// l'envoi.
export async function compressVideo(
  file: File,
  opts?: {
    maxWidth?: number;
    targetBytes?: number;
    hardCapBytes?: number;
    maxBitsPerSecond?: number;
    minBitsPerSecond?: number;
    maxDurationSeconds?: number;
    onProgress?: (pct: number) => void;
  }
): Promise<File> {
  if (!file.type.startsWith("video/")) return file;
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
    reportProgress: boolean
  ): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[compressVideo] Contexte canvas 2D indisponible.");
      return null;
    }

    const canvasStream = canvas.captureStream(30);
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
    if (reportProgress) {
      video.ontimeupdate = () => {
        if (video.duration) opts?.onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
      };
    }

    video.currentTime = 0;
    recorder.start();
    await video.play();
    intervalId = window.setInterval(drawFrame, 1000 / 30);

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    clearInterval(intervalId);
    recorder.stop();

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
    const videoBitsPerSecond = Math.round(Math.min(maxBitsPerSecond, Math.max(minBitsPerSecond, rawVideoBitrate)));
    // À très faible débit (vidéo longue), une résolution plus modeste
    // donne un meilleur rendu qu'une haute résolution trop compressée.
    const effectiveMaxWidth = videoBitsPerSecond <= 700_000 ? Math.min(maxWidth, 854) : maxWidth;

    const scale = Math.min(1, effectiveMaxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const audioTracks = getAudioTracks();

    let blob = await recordPass(width, height, videoBitsPerSecond, audioTracks, true);
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
        false
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
    console.warn("[compressVideo] Erreur pendant la compression — envoi du fichier original.", e);
    return file;
  } finally {
    clearInterval(intervalId);
    URL.revokeObjectURL(url);
    audioCtxRef.current?.close();
  }
}
