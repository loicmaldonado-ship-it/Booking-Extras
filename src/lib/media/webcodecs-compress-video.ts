"use client";

import type { Movie, Track, Sample, ES_Descriptor, VisualSampleEntry, AudioSampleEntry } from "mp4box";

// Voie rapide de compression, en plus de compress-video.ts (méthode
// "temps réel" — canvas + MediaRecorder — qui reste le filet de sécurité).
// Ici on décode/réencode directement via WebCodecs (VideoDecoder/Encoder,
// AudioDecoder/Encoder) sans passer par la lecture d'un <video>, donc sans
// être bridé à la durée réelle de la vidéo — démuxage/muxage MP4 via
// mp4box/mp4-muxer.
//
// Très strictement "fail-open" à chaque étape (navigateur sans WebCodecs,
// fichier pas un MP4/MOV lisible par mp4box, codec non supporté, piste
// audio dont la config ne s'extrait pas proprement...) : on renvoie `null`
// plutôt que de tenter un résultat dégradé, et compress-video.ts prend le
// relais avec la méthode temps réel déjà éprouvée. En particulier, si la
// source a une piste audio mais qu'on n'arrive pas à la configurer
// proprement ici, on abandonne tout plutôt que de livrer une vidéo sans
// son (déjà vécu une fois avec Safari — jamais plus en silence).
export async function compressVideoWebCodecs(
  file: File,
  opts: {
    maxWidth: number;
    targetBytes: number;
    hardCapBytes: number;
    maxBitsPerSecond: number;
    minBitsPerSecond: number;
    maxDurationSeconds: number;
    audioBitsPerSecond: number;
    onProgress?: (pct: number, secondsRemaining?: number) => void;
  }
): Promise<File | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return null;
  if (!/^video\/(mp4|quicktime)/.test(file.type) && !/\.(mp4|mov|m4v)$/i.test(file.name)) return null;

  try {
    const [{ createFile, DataStream, Endianness, MP4BoxBuffer }, { Muxer, ArrayBufferTarget }] = await Promise.all([
      import("mp4box"),
      import("mp4-muxer"),
    ]);

    const arrayBuffer = await file.arrayBuffer();
    const mp4boxFile = createFile();

    // Objet plutôt que `let` séparés : réassignés depuis la closure
    // onReady, TypeScript ne suit pas correctement leur type à travers
    // l'await juste en dessous sinon (même piège que audioCtx plus tôt
    // dans compress-video.ts).
    const state: {
      videoTrack: Track | null;
      audioTrack: Track | null;
      duration: number;
      videoSamples: Sample[];
      audioSamples: Sample[];
    } = { videoTrack: null, audioTrack: null, duration: 0, videoSamples: [], audioSamples: [] };

    // setExtractionOptions + start() DOIVENT être appelés de façon
    // synchrone dans onReady : le fichier entier est déjà en mémoire (voir
    // appendBuffer plus bas), donc mp4box traite tout en une seule passe
    // synchrone depuis cet appel — les mettre en place après un `await`
    // arrive trop tard (le fichier est déjà considéré traité) et
    // onSamples ne se déclenche jamais, d'où un blocage jusqu'au timeout.
    // On se contente ici d'extraire les échantillons bruts ; le décodage/
    // réencodage WebCodecs (qui a besoin d'awaits pour négocier les
    // configs) se fait dans un second temps, une fois tout extrait.
    const ready = new Promise<void>((resolve, reject) => {
      mp4boxFile.onReady = (movie: Movie) => {
        state.videoTrack = movie.videoTracks[0] ?? null;
        state.audioTrack = movie.audioTracks[0] ?? null;
        state.duration = movie.duration / movie.timescale;
        if (!state.videoTrack) {
          resolve();
          return;
        }
        const videoId = state.videoTrack.id;
        const audioId = state.audioTrack?.id ?? -1;
        mp4boxFile.onSamples = (id: number, _user: unknown, samples: Sample[]) => {
          if (id === videoId) state.videoSamples.push(...samples);
          else if (id === audioId) state.audioSamples.push(...samples);
        };
        mp4boxFile.setExtractionOptions(videoId, null, { nbSamples: state.videoTrack.nb_samples });
        if (state.audioTrack) mp4boxFile.setExtractionOptions(audioId, null, { nbSamples: state.audioTrack.nb_samples });
        mp4boxFile.start();
        resolve();
      };
      mp4boxFile.onError = (module: string, message: string) => reject(new Error(`${module}: ${message}`));
    });

    const mp4boxBuffer = MP4BoxBuffer.fromArrayBuffer(arrayBuffer, 0);
    mp4boxFile.appendBuffer(mp4boxBuffer);
    mp4boxFile.flush();
    await ready;

    const videoTrack = state.videoTrack;
    let audioTrack = state.audioTrack;
    const duration = state.duration;
    if (!videoTrack || !videoTrack.video) return null;
    if (duration > opts.maxDurationSeconds || !Number.isFinite(duration) || duration <= 0) return null;
    // Déjà dans le budget -> pas la peine de décoder/réencoder pour rien.
    if (file.size <= opts.targetBytes && videoTrack.video.width <= opts.maxWidth) return file;
    // Fichier fragmenté/streamé où l'extraction en un seul passage n'a pas
    // tout ramené (cas non couvert ici, tout est censé être en mémoire).
    if (state.videoSamples.length < videoTrack.nb_samples) return null;
    if (audioTrack && state.audioSamples.length < audioTrack.nb_samples) return null;

    const videoDescription = extractBoxDescription(mp4boxFile, videoTrack.id, DataStream, Endianness);
    if (!videoDescription) return null;

    let audioDescription: Uint8Array | null = null;
    if (audioTrack && audioTrack.audio) {
      audioDescription = extractAacDecoderConfig(mp4boxFile, audioTrack.id);
      // Piste audio présente mais config illisible -> abandon complet
      // (jamais de sortie silencieuse), voir commentaire en tête de fichier.
      if (!audioDescription) return null;
    } else {
      audioTrack = null;
    }

    // Débit/résolution cible — même calcul que la méthode temps réel, pour
    // un résultat comparable quelle que soit la voie empruntée.
    const rawVideoBitrate = (opts.targetBytes * 8) / duration - opts.audioBitsPerSecond;
    const videoBitsPerSecond = Math.round(
      Math.min(opts.maxBitsPerSecond, Math.max(opts.minBitsPerSecond, rawVideoBitrate))
    );
    const effectiveMaxWidth = videoBitsPerSecond <= 700_000 ? Math.min(opts.maxWidth, 854) : opts.maxWidth;
    const scale = Math.min(1, effectiveMaxWidth / videoTrack.video.width);
    // Les encodeurs matériels exigent généralement des dimensions paires.
    const width = Math.max(2, Math.round((videoTrack.video.width * scale) / 2) * 2);
    const height = Math.max(2, Math.round((videoTrack.video.height * scale) / 2) * 2);

    const videoEncoderConfig = await findSupportedVideoEncoderConfig(width, height, videoBitsPerSecond);
    if (!videoEncoderConfig) return null;

    const audioEncoderConfig: AudioEncoderConfig | null =
      audioTrack && audioTrack.audio
        ? {
            codec: "mp4a.40.2",
            numberOfChannels: audioTrack.audio.channel_count,
            sampleRate: audioTrack.audio.sample_rate,
            bitrate: opts.audioBitsPerSecond,
          }
        : null;
    if (audioEncoderConfig) {
      const support = await AudioEncoder.isConfigSupported(audioEncoderConfig);
      if (!support.supported) return null;
    }

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height },
      audio: audioEncoderConfig
        ? { codec: "aac", numberOfChannels: audioEncoderConfig.numberOfChannels, sampleRate: audioEncoderConfig.sampleRate }
        : undefined,
      fastStart: "in-memory",
    });

    let failed: unknown = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
      error: (e) => {
        failed = failed ?? e;
      },
    });
    videoEncoder.configure(videoEncoderConfig);
    const videoDecoder = new VideoDecoder({
      output: (frame) => {
        videoEncoder.encode(frame);
        frame.close();
      },
      error: (e) => {
        failed = failed ?? e;
      },
    });
    videoDecoder.configure({
      codec: videoTrack.codec,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height,
      description: videoDescription,
    });

    let audioEncoder: AudioEncoder | null = null;
    let audioDecoder: AudioDecoder | null = null;
    if (audioTrack && audioTrack.audio && audioEncoderConfig && audioDescription) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
        error: (e) => {
          failed = failed ?? e;
        },
      });
      audioEncoder.configure(audioEncoderConfig);
      audioDecoder = new AudioDecoder({
        output: (data) => {
          audioEncoder!.encode(data);
          data.close();
        },
        error: (e) => {
          failed = failed ?? e;
        },
      });
      audioDecoder.configure({
        codec: audioTrack.codec,
        sampleRate: audioTrack.audio.sample_rate,
        numberOfChannels: audioTrack.audio.channel_count,
        description: audioDescription,
      });
    }

    const totalVideoSamples = videoTrack.nb_samples;
    const passStart = Date.now();

    // Échantillons déjà extraits (voir onReady plus haut) — reste à les
    // faire passer par décodeur -> encodeur -> muxeur. decode() met en
    // interne en file d'attente ; l'ordre d'arrivée dans le flux de sortie
    // suit celui du décodage, donc les nourrir dans l'ordre suffit.
    for (let i = 0; i < state.videoSamples.length; i++) {
      videoDecoder.decode(sampleToVideoChunk(state.videoSamples[i]));
      if (i % 10 === 0 || i === state.videoSamples.length - 1) {
        const pct = Math.min(99, Math.round(((i + 1) / totalVideoSamples) * 100));
        const elapsed = (Date.now() - passStart) / 1000;
        const secondsRemaining = pct > 0 ? Math.max(0, Math.round((elapsed / pct) * (100 - pct))) : undefined;
        opts.onProgress?.(pct, secondsRemaining);
      }
      if (failed) throw failed;
    }
    if (audioDecoder) {
      for (const s of state.audioSamples) {
        audioDecoder.decode(sampleToAudioChunk(s));
      }
    }

    if (failed) throw failed;

    await videoDecoder.flush();
    await videoEncoder.flush();
    if (audioDecoder && audioEncoder) {
      await audioDecoder.flush();
      await audioEncoder.flush();
    }
    if (failed) throw failed;

    videoDecoder.close();
    videoEncoder.close();
    audioDecoder?.close();
    audioEncoder?.close();

    muxer.finalize();
    opts.onProgress?.(100);

    const blob = new Blob([target.buffer], { type: "video/mp4" });
    if (blob.size === 0 || blob.size >= file.size) return null;
    return new File([blob], file.name.replace(/\.\w+$/, ".mp4"), { type: "video/mp4" });
  } catch (e) {
    console.warn("[compressVideoWebCodecs] Échec de la voie rapide — repli sur la méthode temps réel.", e);
    return null;
  }
}

function sampleToVideoChunk(sample: Sample): EncodedVideoChunk {
  return new EncodedVideoChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp: (sample.cts * 1_000_000) / sample.timescale,
    duration: (sample.duration * 1_000_000) / sample.timescale,
    data: sample.data as BufferSource,
  });
}

function sampleToAudioChunk(sample: Sample): EncodedAudioChunk {
  return new EncodedAudioChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp: (sample.cts * 1_000_000) / sample.timescale,
    duration: (sample.duration * 1_000_000) / sample.timescale,
    data: sample.data as BufferSource,
  });
}

async function findSupportedVideoEncoderConfig(
  width: number,
  height: number,
  bitrate: number
): Promise<VideoEncoderConfig | null> {
  const candidates = ["avc1.640028", "avc1.4d4028", "avc1.42001f"];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: 30,
      avc: { format: "avc" },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return support.config ?? config;
    } catch {
      // essaie le candidat suivant
    }
  }
  return null;
}

type Mp4boxIsoFile = ReturnType<(typeof import("mp4box"))["createFile"]>;
type Mp4boxDataStreamCtor = (typeof import("mp4box"))["DataStream"];
type Mp4boxEndianness = (typeof import("mp4box"))["Endianness"];

// Extrait les octets bruts d'une box de description codec (avcC/hvcC),
// nécessaires à VideoDecoderConfig.description — sans le header de box
// (8 octets : taille + type). Snippet équivalent à celui documenté dans
// les exemples officiels WebCodecs pour le démuxage via mp4box.js.
function extractBoxDescription(
  mp4boxFile: Mp4boxIsoFile,
  trackId: number,
  DataStream: Mp4boxDataStreamCtor,
  Endianness: Mp4boxEndianness
): Uint8Array | null {
  try {
    const trak = mp4boxFile.getTrackById(trackId);
    const entries = (trak?.mdia?.minf?.stbl?.stsd?.entries ?? []) as VisualSampleEntry[];
    for (const entry of entries) {
      const box = entry.avcC ?? entry.hvcC;
      if (!box) continue;
      const ds = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
      // Le type déclaré de write() (MultiBufferStream) ne correspond pas à
      // l'usage réel documenté par mp4box.js lui-même, qui passe bien un
      // DataStream ici — écart de typage de la librairie, pas une erreur
      // de notre côté.
      (box as unknown as { write: (stream: unknown) => void }).write(ds);
      return new Uint8Array(ds.buffer, 8);
    }
    return null;
  } catch {
    return null;
  }
}

// AudioSpecificConfig (AAC), niché dans la box esds — DecoderConfigDescriptor
// (tag 0x04) -> DecoderSpecificInfo (tag 0x05) -> .data, chemin documenté
// par l'API MPEG4DescriptorParser de mp4box.js. Toute forme inattendue est
// traitée comme un échec (fail-open), jamais une config partielle/devinée.
function extractAacDecoderConfig(mp4boxFile: Mp4boxIsoFile, trackId: number): Uint8Array | null {
  try {
    const trak = mp4boxFile.getTrackById(trackId);
    const entries = (trak?.mdia?.minf?.stbl?.stsd?.entries ?? []) as (AudioSampleEntry & {
      esds?: { esd: ES_Descriptor };
    })[];
    for (const entry of entries) {
      const esDescriptor = entry.esds?.esd;
      if (!esDescriptor) continue;
      const decoderConfig = esDescriptor.findDescriptor(0x04);
      const decoderSpecificInfo = decoderConfig?.findDescriptor?.(0x05);
      const data = decoderSpecificInfo?.data;
      if (data instanceof Uint8Array && data.length > 0) return data;
    }
    return null;
  } catch {
    return null;
  }
}
