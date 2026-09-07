"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FigurantForm } from "@/components/figurants/figurant-form";
import { getFigurantForEdit } from "@/lib/figurants/edit";
import { updateFigurantInline } from "@/lib/figurants/actions";
import type { Figurant, FigurantLien } from "@/lib/figurants/types";

// Isolé dans son propre composant, remonté via `key={figurantId}` par le
// parent — un vrai remount réinitialise l'état tout seul si on rouvre sur
// un autre profil, pas besoin de le faire "à la main" dans un effet.
function EditModalBody({ figurantId, onSaved }: { figurantId: string; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<{ figurant: Figurant; liens: FigurantLien[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getFigurantForEdit(figurantId);
      if ("error" in result) setError(result.error);
      else setData(result);
    });
  }, [figurantId, startTransition]);

  // Même sauvegarde que la page /figurants/[id]/modifier, mais sans
  // redirection (updateFigurantInline) — on ferme la fenêtre et on
  // rafraîchit la page en cours à la place, pour ne jamais la quitter.
  async function wrappedAction(prevState: unknown, formData: FormData) {
    const result = await updateFigurantInline(figurantId, prevState, formData);
    if (!result?.error) onSaved();
    return result;
  }

  return (
    <>
      {pending && !data && <p className="text-sm text-text-muted">Chargement...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {data && <FigurantForm action={wrappedAction} figurant={data.figurant} liens={data.liens} />}
    </>
  );
}

// Fenêtre d'édition de la fiche figurant, ouvrable depuis n'importe quelle
// vue (ex. carte casting) sans naviguer vers /figurants/[id]/modifier — pour
// ne jamais perdre l'état de la page en cours (sélection, brouillon
// d'envoi groupé...).
export function FigurantEditModal({ figurantId, onClose }: { figurantId: string; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSaved() {
    router.refresh();
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/80 text-xl text-white hover:bg-danger"
        aria-label="Fermer"
      >
        ×
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border border-border bg-ink-raised p-5"
      >
        <h2 className="mb-4 text-xl font-semibold">Modifier le profil</h2>
        <EditModalBody key={figurantId} figurantId={figurantId} onSaved={handleSaved} />
      </div>
    </div>,
    document.body
  );
}
