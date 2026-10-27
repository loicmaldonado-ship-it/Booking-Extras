"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLien } from "@/lib/figurants/actions";

/** Supprime un lien en affichant les erreurs renvoyées par la Server Action. */
export function DeleteLienButton({ lienId, figurantId }: { lienId: string; figurantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function supprimer() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteLien(lienId, figurantId);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Impossible de supprimer ce lien. Réessaie.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={supprimer}
        disabled={pending}
        aria-label="Supprimer ce lien"
        className="text-text-muted hover:text-coral disabled:opacity-50"
      >
        {pending ? "Suppression..." : "Suppr."}
      </button>
      {error && <span role="alert" className="max-w-56 text-right text-xs text-danger">{error}</span>}
    </div>
  );
}
