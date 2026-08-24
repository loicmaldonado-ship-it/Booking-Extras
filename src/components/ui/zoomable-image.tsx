"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

function LightboxPortal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/80 text-xl text-white hover:bg-danger"
        aria-label="Fermer"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- taille réelle inconnue à l'avance, next/image exige des dimensions */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

// Remplace un <Image fill> classique — même rendu, mais cliquable pour un
// aperçu en grand. Le bouton est en absolute inset-0, donc dépend d'un
// parent "relative" comme les <Image fill> qu'il remplace. À éviter là où
// le clic sur la photo a déjà un autre rôle (ex. ouvrir le sélecteur de
// fichier) — utiliser ZoomButton dans ce cas.
export function ZoomableImage({
  src,
  alt = "",
  imgClassName = "object-cover",
}: {
  src: string;
  alt?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="absolute inset-0 cursor-zoom-in"
        aria-label="Agrandir la photo"
      >
        <Image src={src} alt={alt} fill className={imgClassName} unoptimized />
      </button>
      {open && <LightboxPortal src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

// Petit bouton loupe autonome, pour les endroits où la photo elle-même a
// déjà une autre action au clic (ex. rouvrir le sélecteur de fichier dans
// un dropzone) — même aperçu en grand, sans intercepter le clic principal.
export function ZoomButton({
  src,
  alt = "",
  className = "absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs text-text hover:bg-ink",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
        aria-label="Agrandir la photo"
        title="Agrandir"
      >
        🔍
      </button>
      {open && <LightboxPortal src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
