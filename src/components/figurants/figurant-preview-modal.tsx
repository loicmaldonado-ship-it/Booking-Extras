"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { ContactIcons } from "@/components/ui/contact-icons";
import { getFigurantPreview, type FigurantPreview } from "@/lib/figurants/preview";
import { statutLabel, statutTone } from "@/lib/bookings/types";
import { formatDateShort, formatDateTime } from "@/lib/format-date";

export type PreviewItem = { id: string; prenom: string; nom: string; ville: string | null; portraitUrl: string | null };

// Isolé dans son propre composant, remonté via `key={item.id}` par le
// parent à chaque changement de fiche — un vrai remount réinitialise l'état
// tout seul, pas besoin de remettre data/error à null "à la main" dans un
// effet (ce que react-hooks/set-state-in-effect refuse).
function PreviewBody({ item }: { item: PreviewItem }) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<FigurantPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getFigurantPreview(item.id);
      if ("error" in result) setError(result.error);
      else setData(result);
    });
  }, [item.id, startTransition]);

  return (
    <>
      {pending && !data && <p className="text-sm text-text-muted">Chargement...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          <ContactIcons telephone={data.telephone} email={data.email} variant="inline" />
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Bookings</h3>
            {data.bookings.length === 0 ? (
              <p className="text-sm text-text-muted">Aucun booking pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm">
                    <span className="truncate">
                      {formatDateShort(b.date)} · {b.projetLabel}
                      {b.fonction ? ` · ${b.fonction}` : ""}
                    </span>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Badge tone={statutTone(b.statut as any)}>{statutLabel(b.statut as any)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Échanges (dont réponses mail)
            </h3>
            {data.messages.length === 0 ? (
              <p className="text-sm text-text-muted">Aucun échange pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.sender === "figurant"
                        ? "flex flex-col gap-1 rounded-xl border border-coral/40 bg-coral/10 px-3 py-2"
                        : "flex flex-col gap-1 rounded-xl border border-border bg-ink px-3 py-2"
                    }
                  >
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>
                        {m.sender === "staff" ? "Vous" : item.prenom}
                        {m.projetLabel ? ` · ${m.projetLabel}` : ""}
                      </span>
                      <span>{formatDateTime(m.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{m.corps}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function PreviewModal({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: PreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const hasMultiple = items.length > 1;
  const item = items[index] ?? items[0];

  const goPrev = useCallback(
    () => onIndexChange((index - 1 + items.length) % items.length),
    [index, items.length, onIndexChange]
  );
  const goNext = useCallback(
    () => onIndexChange((index + 1) % items.length),
    [index, items.length, onIndexChange]
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

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        // Même piège que le lightbox photo : le portail sort du DOM mais pas
        // de l'arbre JSX — sans stopPropagation, le clic referme puis
        // continue vers le <Link> de la carte et déclenche une navigation.
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
          aria-label="Profil précédent"
        >
          ‹
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-5"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
            {item.portraitUrl && <Image src={item.portraitUrl} alt="" fill className="object-cover" />}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold">
              {item.prenom} {item.nom}
            </span>
            <span className="text-xs text-text-muted">{item.ville ?? "—"}</span>
          </div>
          <Link
            href={`/figurants/${item.id}`}
            className="shrink-0 text-xs font-medium text-coral hover:underline"
          >
            Fiche complète →
          </Link>
        </div>

        <PreviewBody key={item.id} item={item} />
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-2xl text-white hover:bg-ink sm:right-4"
          aria-label="Profil suivant"
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

// Bouton "aperçu" à poser sur une carte de Base Profils (ou une ligne) —
// ouvre le booking + les échanges du profil sans quitter la page filtrée,
// avec navigation précédent/suivant à travers `items` (la page actuelle
// des résultats, avec ses filtres déjà appliqués).
export function PreviewButton({
  items,
  index,
  className = "flex h-6 w-6 items-center justify-center rounded-full border border-border bg-ink text-xs text-text-muted hover:border-coral/60 hover:text-text",
}: {
  items: PreviewItem[];
  index: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(index);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCurrent(index);
          setOpen(true);
        }}
        className={className}
        aria-label="Aperçu"
        title="Aperçu (bookings, échanges)"
      >
        👁️
      </button>
      {open && <PreviewModal items={items} index={current} onIndexChange={setCurrent} onClose={() => setOpen(false)} />}
    </>
  );
}
