"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { createCastingUploadSlot, finalizeCastingUpload } from "@/lib/casting/upload-actions";
import { compressImage } from "@/lib/media/compress-image";
import { compressVideo } from "@/lib/media/compress-video";
import { translateUploadErrorMessage } from "@/lib/media/upload-error";

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

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-border bg-ink-raised-2 px-4 text-center transition-colors hover:border-coral/60"
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
            <span className="text-xs text-text-muted">Choisir</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onSelect(file);
          if (!file) {
            setPreview(null);
            return;
          }
          const isImage = file.type.startsWith("image/");
          setPreview({ name: file.name, isImage, url: isImage ? URL.createObjectURL(file) : null });
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
}: {
  token: string;
  nbVideos: number;
  photoLabels: string[];
  demandeBandeDemo: boolean;
}) {
  const [videos, setVideos] = useState<(File | null)[]>(Array.from({ length: nbVideos }, () => null));
  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [bandeDemo, setBandeDemo] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function uploadOne(kind: "video" | "photo", slot: string, file: File) {
    const target = await createCastingUploadSlot(token, kind, slot);
    if (target.error || !target.bucket || !target.path || !target.token) {
      throw new Error(target.error ?? "Impossible de préparer l'envoi.");
    }
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(target.bucket)
      .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
    if (uploadError) throw new Error(translateUploadErrorMessage(uploadError.message));
    return target.path;
  }

  async function submit() {
    setError(null);
    if (nbVideos > 0 && !videos[0]) {
      setError("Au moins une vidéo est obligatoire.");
      return;
    }
    setPending(true);
    try {
      const videoPaths: string[] = [];
      for (let i = 0; i < videos.length; i++) {
        const file = videos[i];
        if (!file) continue;
        const compressed = await compressVideo(file, {
          onProgress: (pct) => setStep(`Compression de la vidéo ${i + 1}... ${pct}%`),
        });
        setStep(`Envoi de la vidéo ${i + 1}...`);
        videoPaths.push(await uploadOne("video", String(i), compressed));
      }

      const uploadedPhotos: { label: string; path: string }[] = [];
      for (const label of photoLabels) {
        const file = photos[label];
        if (!file) continue;
        setStep(`Compression de la photo « ${label} »...`);
        const compressed = await compressImage(file);
        setStep(`Envoi de la photo « ${label} »...`);
        uploadedPhotos.push({ label, path: await uploadOne("photo", label, compressed) });
      }

      setStep("Finalisation...");
      const result = await finalizeCastingUpload(token, { videoPaths, photos: uploadedPhotos, bandeDemo });
      if (result?.error) {
        setError(result.error);
        setStep(null);
        return;
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi.");
      setStep(null);
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Envoyé !</h2>
        <p className="text-sm text-text-muted">Merci, tout a bien été reçu.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
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
                accept="image/*"
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

      <Button type="button" disabled={pending} onClick={submit}>
        {pending ? step ?? "Envoi..." : "Envoyer"}
      </Button>
    </div>
  );
}
