"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { submitCastingUpload } from "@/lib/casting/upload-actions";

function VideoSlot({ index }: { index: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">Vidéo {index + 1}</span>
      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-ink-raised-2 px-4 py-8 text-center transition-colors hover:border-coral/60"
      >
        {fileName ? (
          <span className="text-sm text-text">{fileName}</span>
        ) : (
          <>
            <span className="text-lg">+</span>
            <span className="text-xs text-text-muted">Choisir une vidéo</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name="video"
        accept="video/*"
        required={index === 0}
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}

function PhotoSlot({ label }: { label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border bg-ink-raised-2 transition-colors hover:border-coral/60"
    >
      {preview ? (
        <Image src={preview} alt="" fill className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-text-muted">
          <span className="text-lg">+</span>
          <span>{label}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name={`photo__${label}`}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
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
  const [state, formAction, pending] = useActionState(submitCastingUpload.bind(null, token), undefined);

  if (state?.success) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Envoyé !</h2>
        <p className="text-sm text-text-muted">Merci, tout a bien été reçu.</p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}
      {nbVideos > 0 && (
        <Card className="flex flex-col gap-4">
          {Array.from({ length: nbVideos }).map((_, i) => (
            <VideoSlot key={i} index={i} />
          ))}
        </Card>
      )}
      {photoLabels.length > 0 && (
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted">Photos</span>
          <div className="grid grid-cols-3 gap-3">
            {photoLabels.map((label) => (
              <PhotoSlot key={label} label={label} />
            ))}
          </div>
        </Card>
      )}
      {demandeBandeDemo && (
        <Card>
          <Field label="Lien de votre bande démo (optionnel)">
            <Input type="url" name="bande_demo" placeholder="https://..." />
          </Field>
        </Card>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Envoyer"}
      </Button>
    </form>
  );
}
