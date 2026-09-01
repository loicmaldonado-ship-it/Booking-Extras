"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

// Tuile de grille (voir PartageCastingPage) — plusieurs profils affichés
// côte à côte plutôt qu'un par ligne, pour parcourir un rôle d'un coup
// d'œil comme un trombinoscope.
export function CastingRealEntryCard({
  nom,
  portraitUrl,
  roleLabel,
  videoUrls,
  photos,
  lang = DEFAULT_LANG,
}: {
  nom: string;
  portraitUrl: string | null;
  roleLabel?: string | null;
  videoUrls: string[];
  photos: { label: string; url: string }[];
  lang?: Lang;
}) {
  const [open, setOpen] = useState(false);
  const hasMedia = videoUrls.length > 0 || photos.length > 0;
  const gallery: GalleryPhoto[] = photos.map((p) => ({ src: p.url, alt: p.label }));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-ink">
      <button
        type="button"
        onClick={() => hasMedia && setOpen((v) => !v)}
        disabled={!hasMedia}
        className="flex w-full flex-col items-center gap-1.5 p-3 text-center disabled:cursor-default"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
          {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <span className="w-full truncate text-sm font-medium">{nom}</span>
        {roleLabel && <Badge>{roleLabel}</Badge>}
        {hasMedia && (
          <span className="text-xs text-text-muted">
            {videoUrls.length > 0 && `${videoUrls.length} ${t(lang, videoUrls.length > 1 ? "videos" : "video")}`}
            {videoUrls.length > 0 && photos.length > 0 && " · "}
            {photos.length > 0 && `${photos.length} ${t(lang, photos.length > 1 ? "photos" : "photo")}`}
            <span className="ml-1">{open ? "▾" : "▸"}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          {videoUrls.map((url) => (
            <video key={url} controls preload="metadata" className="w-full rounded-lg bg-black">
              <source src={url} />
            </video>
          ))}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative flex flex-col gap-1">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-raised-2">
                    <Image src={p.url} alt={p.label} fill className="object-cover" unoptimized />
                    <ZoomButton src={p.url} alt={p.label} gallery={gallery} index={i} />
                  </div>
                  <span className="text-center text-[11px] text-text-muted">{p.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
