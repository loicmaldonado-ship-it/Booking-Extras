"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submitCastingUpload } from "@/lib/casting/upload-actions";

const MAX_PHOTOS = 3;

function VideoSlot() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">Vidéo de présentation *</span>
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
        required
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}

function PhotoSlot({ name }: { name: string }) {
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
          <span>Photo</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
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

export function CastingUploadForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(submitCastingUpload.bind(null, token), undefined);

  if (state?.success) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Envoyé !</h2>
        <p className="text-sm text-text-muted">Merci, ta vidéo a bien été reçue.</p>
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
      <Card className="flex flex-col gap-4">
        <VideoSlot />
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Photos (optionnel)</span>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: MAX_PHOTOS }).map((_, i) => (
              <PhotoSlot key={i} name="photo" />
            ))}
          </div>
        </div>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Envoyer"}
      </Button>
    </form>
  );
}
