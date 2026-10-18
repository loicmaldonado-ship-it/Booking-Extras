"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";
import type { ReponseCasting } from "@/lib/casting/types";

export type CastingRealEntryItem = {
  id: string;
  nom: string;
  portraitUrl: string | null;
  valide: boolean;
  videoUrls: { url: string; label: string }[];
  photos: { label: string; url: string }[];
  // Pour le·la réal : âge, mensurations et réponses aux questions du rôle.
  age: number | null;
  mensurations: { cle: "mens_taille" | "mens_poids" | "mens_pointure" | "mens_veste" | "mens_pantalon"; valeur: string }[];
  reponses: ReponseCasting[];
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

  // Une seule vidéo OUVERTE (donc montée dans le DOM) à la fois par profil —
  // pas juste "une seule en lecture". Ouvrir un essai puis un autre sans
  // jamais refermer le premier les empilait tous en mémoire (chacun avec
  // autoPlay, son décodeur, ses données mises en tampon) : un réal qui
  // parcourt plusieurs essais sur plusieurs profils sans les refermer au
  // fur et à mesure a fini par figer complètement l'onglet (2026-09-10).
  // Ouvrir un nouvel essai referme donc maintenant automatiquement le
  // précédent plutôt que de s'ajouter à côté.
  // Réinitialisé à chaque changement de profil (précédent/suivant) — ajusté
  // pendant le rendu plutôt que dans un effet (pattern React recommandé
  // pour "réinitialiser un état quand une prop change").
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [openVideoItemId, setOpenVideoItemId] = useState(item?.id);
  if (item?.id !== openVideoItemId) {
    setOpenVideoItemId(item?.id);
    setOpenVideo(null);
  }
  function toggleVideo(url: string) {
    setOpenVideo((prev) => (prev === url ? null : url));
  }

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
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-text/80 text-xl text-white hover:bg-danger"
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
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-text/80 text-2xl text-white hover:bg-text sm:left-4"
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
            {item.portraitUrl && <Image src={item.portraitUrl} alt="" fill sizes="56px" className="object-cover" />}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-semibold">{item.nom}</span>
            <div className="flex flex-wrap gap-1.5">
              {roleLabel && <Badge>{roleLabel}</Badge>}
              <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
            </div>
          </div>
        </div>

        {(item.age !== null || item.mensurations.length > 0) && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {item.age !== null && (
              <span className="rounded-full bg-ink px-2.5 py-1 font-semibold">{t(lang, "age_ans", { n: String(item.age) })}</span>
            )}
            {item.mensurations.map((m) => (
              <span key={m.cle} className="rounded-full bg-ink px-2.5 py-1">
                <span className="text-text-muted">{t(lang, m.cle)} </span>
                <span className="font-semibold">{m.valeur}</span>
              </span>
            ))}
          </div>
        )}

        {item.reponses.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-ink px-3 py-2 text-sm">
            <span className="text-xs font-medium text-text-muted">{t(lang, "reponses_titre")}</span>
            {item.reponses.map((r) => (
              <p key={r.question}>
                {r.question}{" "}
                <strong className={r.reponse === "oui" ? "text-turquoise" : "text-danger"}>{t(lang, r.reponse)}</strong>
                {r.precision ? <span className="text-text-muted"> — {r.precision}</span> : null}
              </p>
            ))}
          </div>
        )}

        {item.videoUrls.map((v) => {
          const isOpen = openVideo === v.url;
          return (
            <div key={v.url} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => toggleVideo(v.url)}
                className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-left text-xs font-medium text-text hover:bg-ink-raised-2 hover:text-text"
              >
                <span className={isOpen ? "transition-transform" : "-rotate-90 transition-transform"}>▾</span>
                {v.label}
              </button>
              {isOpen && (
                // eslint-disable-next-line jsx-a11y/media-has-caption -- vidéo de présentation candidat, pas de sous-titres à fournir
                <video controls autoPlay preload="metadata" className="w-full rounded-lg bg-black">
                  <source src={v.url} />
                </video>
              )}
            </div>
          );
        })}

        {item.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {item.photos.map((p, i) => (
              <div key={p.url} className="relative flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-raised-2">
                  <Image src={p.url} alt={p.label} fill sizes="(min-width: 640px) 150px, 33vw" className="object-cover" />
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
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-text/80 text-2xl text-white hover:bg-text sm:right-4"
          aria-label={t(lang, "profil_suivant")}
        >
          ›
        </button>
      )}

      {hasMultiple && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-text/80 px-3 py-1 text-xs text-white">
          {index + 1} / {items.length}
        </span>
      )}
    </div>,
    document.body
  );
}

// Une carte "trombi" (grande photo, nom en dessous) au lieu d'une ligne
// compacte — pensée pour une grille de plusieurs profils par rôle, où le
// visuel donne envie de cliquer plutôt qu'une liste texte. Le clic ouvre
// une fenêtre dédiée à ce profil, avec précédent/suivant pour parcourir
// les autres profils du même rôle sans fermer/rouvrir à chaque fois.
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
  // La fiche s'ouvre aussi sans vidéo/photo dès qu'il y a des infos à lire.
  const peutOuvrir = hasMedia || item.reponses.length > 0 || item.age !== null || item.mensurations.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!peutOuvrir) return;
          setCurrent(index);
          setOpen(true);
        }}
        disabled={!peutOuvrir}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-ink text-left transition-colors hover:border-coral/60 disabled:cursor-default disabled:hover:border-border"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-ink-raised-2">
          {item.portraitUrl && (
            <Image
              src={item.portraitUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          )}
          {hasMedia && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-text/80 px-2 py-0.5 text-[11px] text-white">
              {item.videoUrls.length > 0 && `${item.videoUrls.length} ${t(lang, item.videoUrls.length > 1 ? "videos" : "video")}`}
              {item.videoUrls.length > 0 && item.photos.length > 0 && " · "}
              {item.photos.length > 0 && `${item.photos.length} ${t(lang, item.photos.length > 1 ? "photos" : "photo")}`}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <span className="break-words text-sm font-medium leading-snug sm:text-base">{item.nom}</span>
          {(item.age !== null || item.mensurations.some((m) => m.cle === "mens_taille")) && (
            <span className="-mt-1 truncate text-xs text-text-muted">
              {[
                item.age !== null ? t(lang, "age_ans", { n: String(item.age) }) : null,
                item.mensurations.find((m) => m.cle === "mens_taille")?.valeur ?? null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {roleLabel && <Badge>{roleLabel}</Badge>}
            <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
          </div>
        </div>
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
