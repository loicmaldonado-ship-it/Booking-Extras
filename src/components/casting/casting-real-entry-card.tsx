"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

export type CastingRealEntryItem = {
  id: string;
  nom: string;
  portraitUrl: string | null;
  valide: boolean;
  videoUrls: { url: string; label: string }[];
  photos: { label: string; url: string }[];
};

// Une fenêtre à la fois pour tout le rôle (au lieu d'un déplié par profil
// dans la page) — avec plusieurs profils dépliés en même temps, la page
// devient vite un fouillis de lecteurs vidéo empilés. Chaque vidéo garde
// ses propres contrôles, sans lecture enchaînée : le·la réal choisit
// laquelle regarder plutôt que de subir un enchaînement automatique.
function CastingRealMediaModal({
  items,
  index,
  roleLabel,
  onIndexChange,
  onClose,
  lang,
}: {
  items: CastingRealEntryItem[];
  index: number;
  roleLabel?: string | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const hasMultiple = items.length > 1;
  const item = items[index] ?? items[0];
  const gallery: GalleryPhoto[] = (item?.photos ?? []).map((p) => ({ src: p.url, alt: p.label }));

  const goPrev = useCallback(
    () => onIndexChange((index - 1 + items.length) % items.length),
    [index, items.length, onIndexChange]
  );
  const goNext = useCallback(() => onIndexChange((index + 1) % items.length), [index, items.length, onIndexChange]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext, hasMultiple]);

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/80 text-xl text-white hover:bg-danger"
        aria-label={t(lang, "fermer")}
      >
        ×
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-2xl text-white hover:bg-ink sm:left-4"
          aria-label={t(lang, "profil_precedent")}
        >
          ‹
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-5"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
            {item.portraitUrl && <Image src={item.portraitUrl} alt="" fill className="object-cover" />}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-semibold">{item.nom}</span>
            <div className="flex flex-wrap gap-1.5">
              {roleLabel && <Badge>{roleLabel}</Badge>}
              <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
            </div>
          </div>
        </div>

        {item.videoUrls.map((v) => (
          <div key={v.url} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">{v.label}</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- vidéo de présentation candidat, pas de sous-titres à fournir */}
            <video controls preload="metadata" className="w-full rounded-lg bg-black">
              <source src={v.url} />
            </video>
          </div>
        ))}

        {item.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {item.photos.map((p, i) => (
              <div key={p.url} className="relative flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-raised-2">
                  <Image src={p.url} alt={p.label} fill className="object-cover" />
                  <ZoomButton src={p.url} alt={p.label} gallery={gallery} index={i} />
                </div>
                <span className="text-center text-[11px] text-text-muted">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-2xl text-white hover:bg-ink sm:right-4"
          aria-label={t(lang, "profil_suivant")}
        >
          ›
        </button>
      )}

      {hasMultiple && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white">
          {index + 1} / {items.length}
        </span>
      )}
    </div>,
    document.body
  );
}

// Une ligne compacte par profil (au lieu du bloc déplié d'avant) — le clic
// ouvre une fenêtre dédiée à ce profil, avec précédent/suivant pour
// parcourir les autres profils du même rôle sans fermer/rouvrir à chaque
// fois.
export function CastingRealEntryCard({
  items,
  index,
  roleLabel,
  lang = DEFAULT_LANG,
}: {
  items: CastingRealEntryItem[];
  index: number;
  roleLabel?: string | null;
  lang?: Lang;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(index);
  const item = items[index];
  if (!item) return null;
  const hasMedia = item.videoUrls.length > 0 || item.photos.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!hasMedia) return;
          setCurrent(index);
          setOpen(true);
        }}
        disabled={!hasMedia}
        className="flex w-full items-center gap-4 rounded-xl border border-border bg-ink px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
          {item.portraitUrl && <Image src={item.portraitUrl} alt="" fill className="object-cover" />}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-medium">{item.nom}</span>
          <div className="flex flex-wrap gap-1.5">
            {roleLabel && <Badge>{roleLabel}</Badge>}
            <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
          </div>
        </div>
        {hasMedia && (
          <span className="text-xs text-text-muted">
            {item.videoUrls.length > 0 && `${item.videoUrls.length} ${t(lang, item.videoUrls.length > 1 ? "videos" : "video")}`}
            {item.videoUrls.length > 0 && item.photos.length > 0 && " · "}
            {item.photos.length > 0 && `${item.photos.length} ${t(lang, item.photos.length > 1 ? "photos" : "photo")}`}
          </span>
        )}
      </button>
      {open && (
        <CastingRealMediaModal
          items={items}
          index={current}
          roleLabel={roleLabel}
          onIndexChange={setCurrent}
          onClose={() => setOpen(false)}
          lang={lang}
        />
      )}
    </>
  );
}
