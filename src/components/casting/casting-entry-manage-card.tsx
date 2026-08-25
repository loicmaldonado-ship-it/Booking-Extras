"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  deleteCastingEntry,
  deleteCastingPhoto,
  addCastingPhoto,
  removeCastingVideo,
  createStaffCastingVideoSlot,
  addCastingVideo,
} from "@/lib/casting/actions";
import type { CastingEntry } from "@/lib/casting/types";
import type { CastingEntryPhoto } from "@/lib/casting/data";

function PhotoUploadSlot({ entryId, label }: { entryId: string; label: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("photo", file);
    startTransition(async () => {
      const result = await addCastingPhoto(entryId, label, fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-ink-raised-2 text-xs text-text-muted transition-colors hover:border-coral/60 disabled:opacity-60"
      >
        <span className="text-lg">+</span>
        {pending ? "Envoi..." : "Ajouter"}
      </button>
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
      <span className="text-center text-[11px] text-text-muted">{label}</span>
      {error && <span className="text-center text-[10px] text-danger">{error}</span>}
    </div>
  );
}

function ExistingPhoto({ photo, gallery, index }: { photo: CastingEntryPhoto; gallery: GalleryPhoto[]; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await deleteCastingPhoto(photo.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
        <Image src={photo.url} alt={photo.label} fill className="object-cover" unoptimized />
        <ZoomButton src={photo.url} alt={photo.label} gallery={gallery} index={index} />
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-danger hover:text-ink disabled:opacity-60"
          title="Retirer cette photo"
        >
          ×
        </button>
      </div>
      <span className="text-center text-[11px] text-text-muted">{photo.label}</span>
    </div>
  );
}

function VideoWithRemove({ entryId, url, path }: { entryId: string; url: string; path: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await removeCastingVideo(entryId, path);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- vidéo de présentation candidat, pas de sous-titres à fournir */}
      <video controls preload="metadata" className="w-full rounded-lg bg-black">
        <source src={url} />
      </video>
      <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
        Retirer cette vidéo
      </Button>
    </div>
  );
}

function AddVideoButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setPending(true);
    try {
      const slot = await createStaffCastingVideoSlot(entryId);
      if (slot.error || !slot.bucket || !slot.path || !slot.token) {
        throw new Error(slot.error ?? "Impossible de préparer l'envoi.");
      }
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(slot.bucket)
        .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const result = await addCastingVideo(entryId, slot.path);
      if (result?.error) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? "Envoi..." : "+ Ajouter une vidéo"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function CastingEntryManageCard({
  entry,
  portraitUrl,
  videoUrls,
  photoLabels,
  photos,
  selected,
  onToggleSelect,
}: {
  entry: CastingEntry;
  portraitUrl: string | null;
  videoUrls: { url: string; path: string }[];
  photoLabels: string[];
  photos: CastingEntryPhoto[];
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function removeEntry() {
    startTransition(async () => {
      await deleteCastingEntry(entry.id);
      router.refresh();
    });
  }

  const gallery: GalleryPhoto[] = photos.map((p) => ({ src: p.url, alt: p.label }));
  const photoByLabel = new Map(photos.map((p) => [p.label, p]));
  const extraPhotos = photos.filter((p) => !photoLabels.includes(p.label));
  const hasMedia = videoUrls.length > 0 || photos.length > 0;

  return (
    <div className="relative flex w-full max-w-xs flex-col gap-2 rounded-xl border border-border bg-ink-raised p-3">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          className="absolute left-4 top-4 z-10 h-4 w-4 rounded border-border accent-coral"
        />
      )}
      <button
        type="button"
        onClick={() => hasMedia && setOpen((v) => !v)}
        disabled={!hasMedia}
        className="flex items-center gap-3 text-left disabled:cursor-default"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
          {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">
            {entry.figurants?.prenom} {entry.figurants?.nom}
          </span>
          {entry.submitted_at ? <Badge tone="turquoise">Envoyé</Badge> : <Badge tone="yellow">En attente</Badge>}
        </div>
        {hasMedia && <span className="text-text-muted">{open ? "▾" : "▸"}</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {videoUrls.map((v) => (
            <VideoWithRemove key={v.path} entryId={entry.id} url={v.url} path={v.path} />
          ))}
          <AddVideoButton entryId={entry.id} />

          {photoLabels.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoLabels.map((label) => {
                const photo = photoByLabel.get(label);
                return photo ? (
                  <ExistingPhoto
                    key={label}
                    photo={photo}
                    gallery={gallery}
                    index={gallery.findIndex((g) => g.src === photo.url)}
                  />
                ) : (
                  <PhotoUploadSlot key={label} entryId={entry.id} label={label} />
                );
              })}
              {extraPhotos.map((photo) => (
                <ExistingPhoto
                  key={photo.id}
                  photo={photo}
                  gallery={gallery}
                  index={gallery.findIndex((g) => g.src === photo.url)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Button type="button" variant="ghost" disabled={pending} onClick={removeEntry}>
        Retirer du rôle
      </Button>
    </div>
  );
}
