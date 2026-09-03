"use client";

// Réduit une vidéo côté navigateur avant l'envoi, sans service payant ni
// librairie lourde (pas de ffmpeg.wasm) : on rejoue la vidéo dans un
// <video> caché, on redessine chaque image sur un canvas à une résolution
// plus raisonnable, et MediaRecorder réenregistre le tout à un débit plus
// faible — piste audio d'origine recombinée au passage. Ça prend le temps
// de la vidéo elle-même (compression en temps réel), d'où le callback de
// progression pour afficher un état d'attente clair.
//
// Toujours "fail-open" : navigateur trop ancien, format non supporté,
// vidéo trop longue, ou n'importe quelle erreur en cours de route -> on
// renvoie le fichier d'origine plutôt que de bloquer l'envoi.
export async function compressVideo(
  file: File,
  opts?: {
    maxWidth?: number;
    videoBitsPerSecond?: number;
    maxDurationSeconds?: number;
    onProgress?: (pct: number) => void;
  }
): Promise<File> {
  if (!file.type.startsWith("video/")) return file;
  if (typeof MediaRecorder === "undefined") return file;
  if (typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) return file;

  const maxWidth = opts?.maxWidth ?? 1280;
  const videoBitsPerSecond = opts?.videoBitsPerSecond ?? 2_000_000;
  const maxDurationSeconds = opts?.maxDurationSeconds ?? 360;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.volume = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Vidéo illisible."));
    });

    if (!video.duration || !Number.isFinite(video.duration) || video.duration > maxDurationSeconds) {
      return file;
    }
    if (!video.videoWidth || !video.videoHeight) return file;

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (scale >= 1 && file.size < 8_000_000) return file; // déjà petite et déjà à la bonne taille

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const canvasStream = canvas.captureStream(30);
    const videoWithCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const audioTracks = videoWithCapture.captureStream?.().getAudioTracks() ?? [];
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

    const mimeType = [
      "video/mp4;codecs=avc1",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) return file;

    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const recordingDone = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    let raf = 0;
    function drawFrame() {
      if (video.paused || video.ended) return;
      ctx!.drawImage(video, 0, 0, width, height);
      raf = requestAnimationFrame(drawFrame);
    }
    video.ontimeupdate = () => {
      if (video.duration) opts?.onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
    };

    recorder.start();
    await video.play();
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    cancelAnimationFrame(raf);
    recorder.stop();

    const blob = await recordingDone;
    opts?.onProgress?.(100);
    if (blob.size >= file.size) return file;

    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    return new File([blob], file.name.replace(/\.\w+$/, `.${ext}`), { type: mimeType });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
