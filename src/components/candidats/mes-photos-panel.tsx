"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { uploadMaPhoto, deleteMaPhoto } from "@/lib/candidats/actions";
import { MAX_PHOTOS_PAR_FIGURANT, type PhotoType } from "@/lib/figurants/types";

type PhotoWithUrl = { id: string; type: PhotoType; url?: string };

const TYPE_LABELS: Record<PhotoType, string> = {
  portrait: "Portrait",
  pied: "Photo en pied",
  selfie: "Selfie (date du jour)",
  autre: "Autre",
  tenue: "Tenue",
  vehicule: "Véhicule",
  casting: "Casting",
};

export function MesPhotosPanel({ photos }: { photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<PhotoType>("autre");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atCap = photos.length >= MAX_PHOTOS_PAR_FIGURANT;
  const photosWithUrl = photos.filter((p) => p.url);
  const gallery: GalleryPhoto[] = photosWithUrl.map((p) => ({ src: p.url!, alt: TYPE_LABELS[p.type] }));
  function galleryIndex(photoId: string) {
    return photosWithUrl.findIndex((p) => p.id === photoId);
  }

  function upload(file: File) {
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("photo", file);
    startTransition(async () => {
      const result = await uploadMaPhoto(undefined, fd);
      setBusy(false);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove(photoId: string) {
    startTransition(async () => {
      await deleteMaPhoto(photoId);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mes photos</h2>
        <span className="text-xs text-text-muted">
          {photos.length}/{MAX_PHOTOS_PAR_FIGURANT}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-ink">
              {p.url && <Image src={p.url} alt={TYPE_LABELS[p.type]} fill className="object-cover" unoptimized />}
              {p.url && (
                <ZoomButton src={p.url} alt={TYPE_LABELS[p.type]} gallery={gallery} index={galleryIndex(p.id)} />
              )}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-coral hover:text-ink"
              >
                ×
              </button>
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] text-text-muted">
                {TYPE_LABELS[p.type]}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {atCap ? (
        <p className="text-xs text-text-muted">Maximum {MAX_PHOTOS_PAR_FIGURANT} photos atteint.</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PhotoType)}
            className="rounded-lg border border-border bg-ink px-2 py-1.5 text-sm"
          >
            <option value="portrait">Portrait</option>
            <option value="pied">Photo en pied</option>
            <option value="selfie">Selfie (date du jour)</option>
            <option value="vehicule">Véhicule</option>
            <option value="autre">Autre</option>
          </select>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
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
