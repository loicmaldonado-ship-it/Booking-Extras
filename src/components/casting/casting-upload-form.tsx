"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DateNaissanceField } from "@/components/ui/date-naissance-field";
import { GENRES } from "@/lib/figurants/types";
import type { FicheCasting } from "@/lib/casting/fiche";
import type { ReponseCasting } from "@/lib/casting/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { createCastingUploadSlot, finalizeCastingUpload } from "@/lib/casting/upload-actions";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { envoyerVideo, declencherAllegement, formatTaille, formatRestant, type Progression } from "@/lib/media/upload-video";
import { translateUploadErrorMessage } from "@/lib/media/upload-error";
import { cn } from "@/lib/cn";

function FileSlot({
  label,
  accept,
  required,
  onSelect,
}: {
  label: string;
  accept: string;
  required?: boolean;
  onSelect: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ name: string; isImage: boolean; url: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const url = preview?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [preview?.url]);

  function selectFile(file: File | null) {
    onSelect(file);
    if (!file) {
      setPreview(null);
      return;
    }
    const isImage = file.type.startsWith("image/");
    setPreview({ name: file.name, isImage, url: isImage ? URL.createObjectURL(file) : null });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        aria-label={`Choisir le fichier : ${label}${required ? " (obligatoire)" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) selectFile(file);
        }}
        className={cn(
          "relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-ink-raised-2 px-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral",
          dragOver ? "border-coral bg-coral/10" : "border-border hover:border-coral/60"
        )}
      >
        {preview ? (
          preview.isImage && preview.url ? (
            <Image src={preview.url} alt="" fill className="object-cover" unoptimized />
          ) : (
            <span className="text-sm text-text">{preview.name}</span>
          )
        ) : (
          <>
            <span className="text-lg">+</span>
            <span className="text-xs text-text-muted">Choisir ou glisser</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={`Fichier : ${label}`}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

type VideoCandidat = {
  file: File | null;
  statut: "vide" | "envoi" | "ok" | "erreur";
  progression: Progression | null;
  path: string | null;
  erreur: string | null;
};

const VIDEO_VIDE: VideoCandidat = { file: null, statut: "vide", progression: null, path: null, erreur: null };

// Une vidéo : elle part dès qu'elle est choisie (pendant qu'on remplit la
// fiche), avec sa barre de progression.
function VideoSlot({
  label,
  required,
  video,
  onChoisir,
  onRetirer,
  onReessayer,
}: {
  label: string;
  required?: boolean;
  video: VideoCandidat;
  onChoisir: (file: File) => void;
  onRetirer: () => void;
  onReessayer: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const pct = video.progression?.pct ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {video.statut === "vide" ? (
        <button
          type="button"
          aria-label={`Choisir une vidéo : ${label}${required ? " (obligatoire)" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onChoisir(f);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragOver ? "border-coral bg-coral/10" : "border-border-strong bg-ink-raised-2 hover:border-text"
          )}
        >
          <span className="text-2xl">🎬</span>
          <span className="text-sm font-semibold">Choisir ou glisser la vidéo</span>
          <span className="text-xs text-text-muted">Elle part tout de suite, pas besoin de la compresser.</span>
        </button>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border-2 px-3 py-3",
            video.statut === "ok" ? "border-turquoise/60 bg-turquoise/10" : video.statut === "erreur" ? "border-danger/50 bg-danger/10" : "border-border bg-ink-raised-2"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium" title={video.file?.name}>
              🎬 {video.file?.name}
            </span>
            <button
              type="button"
              onClick={onRetirer}
              className="shrink-0 rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-text"
            >
              {video.statut === "envoi" ? "Annuler" : "Retirer"}
            </button>
          </div>
          {video.statut === "envoi" && (
            <>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-raised">
                <div className="h-full rounded-full bg-turquoise transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-text-muted">
                Envoi {pct} %
                {video.progression?.restant != null && video.progression.restant > 1 ? ` · ${formatRestant(video.progression.restant)}` : ""} ·{" "}
                {formatTaille(video.file?.size ?? 0)}
                {(video.progression?.essai ?? 1) > 1 ? ` · nouvel essai (${video.progression?.essai}/3)` : ""}
              </span>
            </>
          )}
          {video.statut === "ok" && <span className="text-sm font-medium text-turquoise">✓ Vidéo envoyée ({formatTaille(video.file?.size ?? 0)})</span>}
          {video.statut === "erreur" && (
            <>
              <span className="text-sm text-danger">{video.erreur}</span>
              <button
                type="button"
                onClick={onReessayer}
                className="self-start rounded-full border border-text px-3 py-1 text-xs font-semibold text-coral"
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChoisir(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function CastingUploadForm({
  token,
  nbVideos,
  photoLabels,
  demandeBandeDemo,
  apresEnvoi = null,
  fiche,
  questions = [],
}: {
  token: string;
  nbVideos: number;
  photoLabels: string[];
  demandeBandeDemo: boolean;
  // Affiché sous « Envoyé ! » (ex. proposition de créer un compte).
  apresEnvoi?: ReactNode;
  // Fiche à compléter / vérifier (pré-remplie avec ce qu'on sait déjà).
  fiche: FicheCasting;
  // Questions oui / non du rôle (réponse obligatoire, précision libre).
  questions?: string[];
}) {
  const ficheRef = useRef<HTMLFormElement>(null);
  const [videos, setVideos] = useState<VideoCandidat[]>(Array.from({ length: nbVideos }, () => VIDEO_VIDE));
  const controllersVideo = useRef(new Map<number, AbortController>());
  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [bandeDemo, setBandeDemo] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Photos uniquement — les vidéos partent dès qu'elles sont choisies
  // (envoyerVideo, mutualisé avec la carte équipe).
  async function uploadOnePhoto(slot: string, file: File, signal: AbortSignal) {
    if (signal.aborted) throw new DOMException("Annulé", "AbortError");
    let finished = false;
    return new Promise<string>((resolve, reject) => {
      const cleanUp = () => {
        finished = true;
        clearTimeout(timeoutId);
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanUp();
        reject(new DOMException("Annulé", "AbortError"));
      };
      const timeoutId = setTimeout(() => {
        cleanUp();
        reject(new Error("L'envoi prend trop de temps — vérifie ta connexion et réessaie."));
      }, 120_000);
      signal.addEventListener("abort", onAbort, { once: true });
      (async () => {
        const target = await createCastingUploadSlot(token, "photo", slot);
        // An abandoned slot must not start an upload after the user cancels.
        if (finished || signal.aborted) throw new DOMException("Annulé", "AbortError");
        if (target.error || !target.bucket || !target.path || !target.token) {
          throw new Error(target.error ?? "Impossible de préparer l'envoi.");
        }
        const supabase = createBrowserSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from(target.bucket)
          .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
        if (uploadError) throw new Error(translateUploadErrorMessage(uploadError.message));
        return target.path;
      })().then((path) => {
        if (finished) return;
        cleanUp();
        resolve(path);
      }, (error) => {
        if (finished) return;
        cleanUp();
        reject(error);
      });
    });
  }

  function majVideo(i: number, patch: Partial<VideoCandidat>) {
    setVideos((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  // Envoi immédiat d'une vidéo choisie (remplace celle du créneau s'il y en a une).
  async function lancerVideo(i: number, file: File) {
    controllersVideo.current.get(i)?.abort();
    const controller = new AbortController();
    controllersVideo.current.set(i, controller);
    setError(null);
    majVideo(i, { file, statut: "envoi", progression: { pct: 0, restant: null, essai: 1 }, path: null, erreur: null });
    try {
      const path = await envoyerVideo({
        file,
        signal: controller.signal,
        onProgress: (progression) => majVideo(i, { progression }),
        createSlot: () => createCastingUploadSlot(token, "video", String(i)),
        logContext: { source: "candidat", requestToken: token },
      });
      majVideo(i, { statut: "ok", path, progression: { pct: 100, restant: 0, essai: 1 } });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      majVideo(i, { statut: "erreur", erreur: e instanceof Error ? e.message : "Échec de l'envoi." });
    } finally {
      if (controllersVideo.current.get(i) === controller) controllersVideo.current.delete(i);
    }
  }

  function retirerVideo(i: number) {
    controllersVideo.current.get(i)?.abort();
    controllersVideo.current.delete(i);
    majVideo(i, VIDEO_VIDE);
  }

  // Une vidéo encore en route : on prévient avant de quitter la page.
  const videoEnCours = videos.some((v) => v.statut === "envoi");
  useEffect(() => {
    if (!videoEnCours) return;
    const avertir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [videoEnCours]);

  function lireFiche(): FicheCasting | null {
    const form = ficheRef.current;
    if (!form) return null;
    if (!form.checkValidity()) {
      form.reportValidity();
      return null;
    }
    const fd = new FormData(form);
    const texte = (k: string) => String(fd.get(k) ?? "").trim() || null;
    const nombre = (k: string) => {
      const v = texte(k);
      return v === null ? null : Number(v.replace(",", "."));
    };
    return {
      date_naissance: texte("date_naissance"),
      genre: texte("genre"),
      code_postal: texte("code_postal"),
      ville: texte("ville"),
      taille_cm: nombre("taille_cm"),
      poids_kg: nombre("poids_kg"),
      pointure: nombre("pointure"),
      veste: texte("veste"),
      pantalon: texte("pantalon"),
    };
  }

  function lireReponses(): ReponseCasting[] | null {
    const form = ficheRef.current;
    if (!form || questions.length === 0) return [];
    const fd = new FormData(form);
    const reponses: ReponseCasting[] = [];
    for (let i = 0; i < questions.length; i++) {
      const r = fd.get(`question_${i}`);
      if (r !== "oui" && r !== "non") return null;
      const precision = String(fd.get(`precision_${i}`) ?? "").trim();
      reponses.push({ question: questions[i], reponse: r, precision: precision || null });
    }
    return reponses;
  }

  async function submit() {
    setError(null);
    const ficheRemplie = lireFiche();
    const reponses = lireReponses();
    if (ficheRemplie && !reponses) {
      setError("Réponds à toutes les questions (oui ou non).");
      return;
    }
    if (!ficheRemplie) {
      setError(
        questions.length > 0
          ? "Complète ta fiche et réponds aux questions avant d'envoyer (les champs manquants sont signalés)."
          : "Complète ta fiche (date de naissance, mensurations…) avant d'envoyer."
      );
      return;
    }
    if (!ficheRemplie.date_naissance) {
      setError("Indique ta date de naissance.");
      return;
    }
    if (nbVideos > 0 && videos[0].statut !== "ok") {
      setError(
        videos[0].statut === "erreur"
          ? "La vidéo n'a pas pu être envoyée : touche « Réessayer »."
          : "Au moins une vidéo est obligatoire."
      );
      return;
    }
    if (videos.some((v) => v.statut === "erreur")) {
      setError("Une vidéo n'a pas pu être envoyée : touche « Réessayer » ou retire-la.");
      return;
    }
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const videoPaths = videos.map((v) => v.path).filter((p): p is string => !!p);

      const uploadedPhotos: { label: string; path: string }[] = [];
      for (const label of photoLabels) {
        if (controller.signal.aborted) throw new DOMException("Annulé", "AbortError");
        const file = photos[label];
        if (!file) continue;
        setStep(`Compression de la photo « ${label} »...`);
        const prepare = await prepareImage(file);
        if ("error" in prepare) {
          setError(`Photo « ${label} » : ${prepare.error}`);
          setStep(null);
          return;
        }
        if (controller.signal.aborted) throw new DOMException("Annulé", "AbortError");
        setStep(`Envoi de la photo « ${label} »...`);
        uploadedPhotos.push({ label, path: await uploadOnePhoto(label, prepare.file, controller.signal) });
      }

      if (controller.signal.aborted) throw new DOMException("Annulé", "AbortError");
      setStep("Finalisation...");
      const result = await finalizeCastingUpload(token, { videoPaths, photos: uploadedPhotos, bandeDemo, fiche: ficheRemplie, reponses: reponses ?? [] });
      if (result?.error) {
        setError(result.error);
        setStep(null);
        return;
      }
      videoPaths.forEach(declencherAllegement);
      setSuccess(true);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Échec de l'envoi.");
      }
      setStep(null);
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }

  if (success) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Envoyé !</h2>
        <p className="text-sm text-text-muted">Merci, tout a bien été reçu.</p>
        {apresEnvoi}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Ta fiche</h2>
          <p className="text-xs text-text-muted">Vérifie ou complète tes infos : elles servent pour le casting et les costumes.</p>
        </div>
        <form ref={ficheRef} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateNaissanceField name="date_naissance" required defaultValue={fiche.date_naissance} />
            <Field label="Genre" required>
              <Select name="genre" required defaultValue={fiche.genre ?? ""}>
                <option value="" disabled></option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Code postal" required>
              <Input name="code_postal" required defaultValue={fiche.code_postal ?? undefined} />
            </Field>
            <Field label="Ville" required>
              <Input name="ville" required defaultValue={fiche.ville ?? undefined} />
            </Field>
          </div>
          <span className="text-xs font-medium text-text-muted">Mensurations</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Taille (cm)" required>
              <Input type="number" name="taille_cm" required min={50} max={250} defaultValue={fiche.taille_cm ?? undefined} />
            </Field>
            <Field label="Poids (kg)" required>
              <Input type="number" name="poids_kg" required min={10} max={300} defaultValue={fiche.poids_kg ?? undefined} />
            </Field>
            <Field label="Pointure" required>
              <Input
                type="number"
                name="pointure"
                required
                min={15}
                max={60}
                step={0.5}
                defaultValue={fiche.pointure ?? undefined}
              />
            </Field>
            <Field label="Taille de veste" required>
              <Input name="veste" placeholder="Ex. 48/50" required defaultValue={fiche.veste ?? undefined} />
            </Field>
            <Field label="Taille de pantalon" required>
              <Input name="pantalon" placeholder="Ex. 42" required defaultValue={fiche.pantalon ?? undefined} />
            </Field>
          </div>
          {questions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <span className="text-xs font-medium text-text-muted">Questions</span>
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{q} *</span>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name={`question_${i}`} value="oui" required className="accent-turquoise" />
                      Oui
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name={`question_${i}`} value="non" required className="accent-coral" />
                      Non
                    </label>
                    <Input
                      name={`precision_${i}`}
                      placeholder="Précision (facultatif)"
                      maxLength={200}
                      className="min-w-0 flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>
      </Card>
      {nbVideos > 0 && (
        <Card className="flex flex-col gap-4">
          {videos.map((v, i) => (
            <VideoSlot
              key={i}
              label={`Vidéo ${i + 1}`}
              required={i === 0}
              video={v}
              onChoisir={(file) => lancerVideo(i, file)}
              onRetirer={() => retirerVideo(i)}
              onReessayer={() => v.file && lancerVideo(i, v.file)}
            />
          ))}
        </Card>
      )}
      {photoLabels.length > 0 && (
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted">Photos</span>
          <div className="grid grid-cols-3 gap-3">
            {photoLabels.map((label) => (
              <FileSlot
                key={label}
                label={label}
                accept={ACCEPT_IMAGES}
                onSelect={(file) => setPhotos((prev) => ({ ...prev, [label]: file }))}
              />
            ))}
          </div>
        </Card>
      )}
      {demandeBandeDemo && (
        <Card>
          <Field label="Lien de votre bande démo (optionnel)">
            <Input type="url" value={bandeDemo} onChange={(e) => setBandeDemo(e.target.value)} placeholder="https://..." />
          </Field>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="button" disabled={pending || videoEnCours} onClick={submit} className="flex-1">
          {pending
            ? step ?? "Envoi..."
            : videoEnCours
              ? `Vidéo en cours d'envoi… ${videos.find((v) => v.statut === "envoi")?.progression?.pct ?? 0} %`
              : "Envoyer"}
        </Button>
        {pending && (
          <Button type="button" variant="ghost" onClick={() => abortRef.current?.abort()}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
