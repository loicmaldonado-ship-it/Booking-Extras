"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

// Fenêtre par-dessus la page (envoi de messages…) plutôt qu'un bandeau de
// plus dans la page. Échap ou clic à côté pour fermer, sauf pendant un envoi.
export function Modale({
  titre,
  sousTitre,
  onClose,
  bloquee = false,
  large = false,
  children,
}: {
  titre: ReactNode;
  sousTitre?: ReactNode;
  onClose: () => void;
  bloquee?: boolean;
  large?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape" && !bloquee) onClose();
    }
    document.addEventListener("keydown", surTouche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflow;
    };
  }, [onClose, bloquee]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
      onClick={() => !bloquee && onClose()}
    >
      <div
        className={cn(
          "flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-5 shadow-xl",
          large ? "max-w-3xl" : "max-w-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{titre}</h3>
            {sousTitre && <p className="text-sm text-text-muted">{sousTitre}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={bloquee}
            className="text-sm text-text-muted hover:text-text disabled:opacity-40"
          >
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
