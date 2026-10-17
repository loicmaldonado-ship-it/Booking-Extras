"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DateNaissanceField } from "@/components/ui/date-naissance-field";
import { GENRES } from "@/lib/figurants/types";
import type { FicheCasting } from "@/lib/casting/fiche";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { createCastingUploadSlot, finalizeCastingUpload } from "@/lib/casting/upload-actions";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { compressAndUploadVideo } from "@/lib/media/compress-and-upload-video";
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
      <div
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
          "relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-ink-raised-2 px-4 text-center transition-colors",
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
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
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
}: {
  token: string;
  nbVideos: number;
  photoLabels: string[];
  demandeBandeDemo: boolean;
  // Affiché sous « Envoyé ! » (ex. proposition de créer un compte).
  apresEnvoi?: ReactNode;
  // Fiche à compléter / vérifier (pré-remplie avec ce qu'on sait déjà).
  fiche: FicheCasting;
}) {
  const ficheRef = useRef<HTMLFormElement>(null);
  const [videos, setVideos] = useState<(File | null)[]>(Array.from({ length: nbVideos }, () => null));
  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [bandeDemo, setBandeDemo] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Photos uniquement — l'envoi vidéo (compression + envoi avec course
  // contre timeout/annulation) est mutualisé avec la carte équipe dans
  // compress-and-upload-video.ts.
  async function uploadOnePhoto(slot: string, file: File, signal: AbortSignal) {
    const attempt = (async () => {
      const target = await createCastingUploadSlot(token, "photo", slot);
      if (target.error || !target.bucket || !target.path || !target.token) {
        throw new Error(target.error ?? "Impossible de préparer l'envoi.");
      }
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
      if (uploadError) throw new Error(translateUploadErrorMessage(uploadError.message));
      return target.path;
    })();
    return new Promise<string>((resolve, reject) => {
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
  }

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

  async function submit() {
    setError(null);
    const ficheRemplie = lireFiche();
    if (!ficheRemplie) {
      setError("Complète ta fiche (date de naissance, mensurations…) avant d'envoyer.");
      return;
    }
    if (!ficheRemplie.date_naissance) {
      setError("Indique ta date de naissance.");
      return;
    }
    if (nbVideos > 0 && !videos[0]) {
      setError("Au moins une vidéo est obligatoire.");
      return;
    }
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const videoPaths: string[] = [];
      for (let i = 0; i < videos.length; i++) {
        const file = videos[i];
        if (!file) continue;
        if (controller.signal.aborted) throw new DOMException("Annulé", "AbortError");
        const path = await compressAndUploadVideo({
          file,
          signal: controller.signal,
          onProgress: (label) => setStep(`Vidéo ${i + 1} — ${label}`),
          createSlot: () => createCastingUploadSlot(token, "video", String(i)),
          logContext: { source: "candidat", requestToken: token },
        });
        videoPaths.push(path);
      }

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
        setStep(`Envoi de la photo « ${label} »...`);
        uploadedPhotos.push({ label, path: await uploadOnePhoto(label, prepare.file, controller.signal) });
      }

      if (controller.signal.aborted) throw new DOMException("Annulé", "AbortError");
      setStep("Finalisation...");
      const result = await finalizeCastingUpload(token, { videoPaths, photos: uploadedPhotos, bandeDemo, fiche: ficheRemplie });
      if (result?.error) {
        setError(result.error);
        setStep(null);
        return;
      }
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
        </form>
      </Card>
      {nbVideos > 0 && (
        <Card className="flex flex-col gap-4">
          {videos.map((_, i) => (
            <FileSlot
              key={i}
              label={`Vidéo ${i + 1}`}
              accept="video/*"
              required={i === 0}
              onSelect={(file) => setVideos((prev) => prev.map((v, idx) => (idx === i ? file : v)))}
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
        <Button type="button" disabled={pending} onClick={submit} className="flex-1">
          {pending ? step ?? "Envoi..." : "Envoyer"}
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
