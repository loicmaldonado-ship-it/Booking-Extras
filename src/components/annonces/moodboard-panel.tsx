"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addAnnoncePhoto, removeAnnoncePhoto } from "@/lib/annonces/moodboard-actions";
import { MAX_MOODBOARD_PHOTOS, type MoodboardPhoto } from "@/lib/annonces/moodboard";

export function MoodboardPanel({ annonceId, photos }: { annonceId: string; photos: MoodboardPhoto[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const atCap = photos.length >= MAX_MOODBOARD_PHOTOS;

  function upload(file: File) {
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("photo", file);
    startTransition(async () => {
      const result = await addAnnoncePhoto(annonceId, fd);
      setBusy(false);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove(photoId: string) {
    startTransition(async () => {
      await removeAnnoncePhoto(photoId);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Moodboard</h2>
          <p className="mt-1 text-sm text-text-muted">
            Photos d&apos;ambiance affichées aux candidat·es sur la page de candidature publique.
          </p>
        </div>
        <span className="text-xs text-text-muted">
          {photos.length}/{MAX_MOODBOARD_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-ink">
              <Image src={p.url} alt="" fill className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-coral hover:text-ink"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {atCap ? (
        <p className="text-xs text-text-muted">Maximum {MAX_MOODBOARD_PHOTOS} photos atteint.</p>
      ) : (
        <div>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Envoi..." : "+ Ajouter une photo"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </Card>
  );
}
