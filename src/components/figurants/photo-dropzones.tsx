"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { uploadFigurantPhoto, deletePhoto } from "@/lib/figurants/actions";
import { ZoomButton } from "@/components/ui/zoomable-image";
import { MAX_PHOTOS_PAR_FIGURANT, type PhotoType } from "@/lib/figurants/types";

type PhotoWithUrl = { id: string; type: PhotoType; url?: string };

const SLOTS: { key: string; type: PhotoType; label: string }[] = [
  { key: "portrait", type: "portrait", label: "Portrait" },
  { key: "pied", type: "pied", label: "Pied" },
  { key: "autre1", type: "autre", label: "Autre" },
  { key: "autre2", type: "autre", label: "Autre" },
  { key: "selfie", type: "selfie", label: "Selfie" },
];

export function PhotoDropzones({ figurantId, photos }: { figurantId: string; photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const autrePhotos = photos.filter((p) => p.type === "autre");

  function photoForSlot(key: string, type: PhotoType) {
    if (type !== "autre") return photos.find((p) => p.type === type) ?? null;
    return key === "autre1" ? (autrePhotos[0] ?? null) : (autrePhotos[1] ?? null);
  }

  // Anything not shown in the 5 primary slots (e.g. a second portrait from a
  // re-upload, or a 3rd+ "autre") still needs somewhere to appear and be
  // deletable — nothing should silently disappear from view.
  const shownIds = new Set(SLOTS.map((slot) => photoForSlot(slot.key, slot.type)?.id).filter(Boolean));
  const extraPhotos = photos.filter((p) => !shownIds.has(p.id));

  function upload(key: string, type: PhotoType, file: File) {
    setError(null);
    setBusyKey(key);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("photo", file);
    startTransition(async () => {
      const result = await uploadFigurantPhoto(figurantId, undefined, fd);
      setBusyKey(null);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function remove(photoId: string) {
    startTransition(async () => {
      await deletePhoto(photoId, figurantId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {SLOTS.map((slot) => {
          const photo = photoForSlot(slot.key, slot.type);
          const isDragOver = dragKey === slot.key;
          const isBusy = busyKey === slot.key;

          return (
            <div key={slot.key} className="flex flex-col gap-1.5">
              <div
                onClick={() => !isBusy && inputRefs.current[slot.key]?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragKey(slot.key);
                }}
                onDragLeave={() => setDragKey((k) => (k === slot.key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragKey(null);
                  const file = e.dataTransfer.files?.[0];
                  if (file) upload(slot.key, slot.type, file);
                }}
                className={cn(
                  "relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-ink-raised-2 transition-colors",
                  isDragOver ? "border-coral bg-coral/10" : "border-border hover:border-coral/60",
                  isBusy && "cursor-wait opacity-60"
                )}
              >
                {photo?.url ? (
                  <Image src={photo.url} alt={slot.label} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-text-muted">
                    <span className="text-lg">+</span>
                    <span>{isBusy ? "Envoi..." : "Glisser ou cliquer"}</span>
                  </div>
                )}
                {photo?.url && <ZoomButton src={photo.url} alt={slot.label} />}
                {photo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(photo.id);
                    }}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-coral hover:text-ink"
                  >
                    ×
                  </button>
                )}
                <input
                  ref={(el) => {
                    inputRefs.current[slot.key] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(slot.key, slot.type, file);
                    e.target.value = "";
                  }}
                />
              </div>
              <span className="text-center text-xs text-text-muted">{slot.label}</span>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <span className="text-xs text-text-muted">
        {photos.length}/{MAX_PHOTOS_PAR_FIGURANT} photos
      </span>

      {extraPhotos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-text-muted">Photos supplémentaires</span>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {extraPhotos.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-ink">
                {p.url && <Image src={p.url} alt="" fill className="object-cover" unoptimized />}
                {p.url && <ZoomButton src={p.url} />}
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
        </div>
      )}
    </div>
  );
}
