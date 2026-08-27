"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

export type GalleryPhoto = { src: string; alt?: string };

function LightboxPortal({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const hasMultiple = photos.length > 1;
  const photo = photos[index] ?? photos[0];

  const goPrev = useCallback(
    () => onIndexChange((index - 1 + photos.length) % photos.length),
    [index, photos.length, onIndexChange]
  );
  const goNext = useCallback(
    () => onIndexChange((index + 1) % photos.length),
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext, hasMultiple]);

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-6"
      onClick={(e) => {
        // Le portail rend hors de l'arbre DOM (document.body), mais React
        // fait quand même remonter l'événement à travers l'arbre JSX
        // d'origine — sans stopPropagation, un clic ici referme bien
        // l'aperçu mais continue vers un <Link>/onClick parent (la carte
        // du profil) et déclenche une navigation.
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/80 text-xl text-white hover:bg-danger"
        aria-label="Fermer"
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
          aria-label="Photo précédente"
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- taille réelle inconnue à l'avance, next/image exige des dimensions */}
      <img
        src={photo.src}
        alt={photo.alt ?? ""}
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-2xl text-white hover:bg-ink sm:right-4"
          aria-label="Photo suivante"
        >
          ›
        </button>
      )}

      {hasMultiple && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white">
          {index + 1} / {photos.length}
        </span>
      )}
    </div>,
    document.body
  );
}

function useLightbox(index: number) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(index);
  return {
    open,
    current,
    setCurrent,
    show: () => {
      setCurrent(index);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}

// Remplace un <Image fill> classique — même rendu, mais cliquable pour un
// aperçu en grand. Le bouton est en absolute inset-0, donc dépend d'un
// parent "relative" comme les <Image fill> qu'il remplace. À éviter là où
// le clic sur la photo a déjà un autre rôle (ex. ouvrir le sélecteur de
// fichier) — utiliser ZoomButton dans ce cas.
//
// `gallery` (optionnel) : liste complète des photos de la fiche, pour
// naviguer au clavier (← →) sans refermer l'aperçu. Sans elle, l'aperçu ne
// montre que `src` seule.
export function ZoomableImage({
  src,
  alt = "",
  imgClassName = "object-cover",
  gallery,
  index = 0,
}: {
  src: string;
  alt?: string;
  imgClassName?: string;
  gallery?: GalleryPhoto[];
  index?: number;
}) {
  const photos = gallery && gallery.length > 0 ? gallery : [{ src, alt }];
  const { open, current, setCurrent, show, close } = useLightbox(index);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
        className="absolute inset-0 cursor-zoom-in"
        aria-label="Agrandir la photo"
      >
        <Image src={src} alt={alt} fill className={imgClassName} unoptimized />
      </button>
      {open && <LightboxPortal photos={photos} index={current} onIndexChange={setCurrent} onClose={close} />}
    </>
  );
}

// Petit bouton loupe autonome, pour les endroits où la photo elle-même a
// déjà une autre action au clic (ex. rouvrir le sélecteur de fichier dans
// un dropzone) — même aperçu en grand, sans intercepter le clic principal.
//
// `gallery`/`index` : mêmes règles que ZoomableImage, pour naviguer entre
// toutes les photos d'une fiche.
export function ZoomButton({
  src,
  alt = "",
  gallery,
  index = 0,
  className = "absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs text-text hover:bg-ink",
}: {
  src: string;
  alt?: string;
  gallery?: GalleryPhoto[];
  index?: number;
  className?: string;
}) {
  const photos = gallery && gallery.length > 0 ? gallery : [{ src, alt }];
  const { open, current, setCurrent, show, close } = useLightbox(index);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
        className={className}
        aria-label="Agrandir la photo"
        title="Agrandir"
      >
        🔍
      </button>
      {open && <LightboxPortal photos={photos} index={current} onIndexChange={setCurrent} onClose={close} />}
    </>
  );
}
