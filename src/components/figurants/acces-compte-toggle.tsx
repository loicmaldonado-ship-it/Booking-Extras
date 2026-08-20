"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAccesCompte } from "@/lib/candidats/actions";

export function AccesCompteToggle({ figurantId, actif }: { figurantId: string; actif: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleAccesCompte(figurantId, !actif);
      if ("emailError" in result && result.emailError) {
        setError(`Accès activé, mais l'email n'a pas pu être envoyé : ${result.emailError}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={actif}
          disabled={pending}
          onChange={toggle}
          className="h-4 w-4 rounded border-border accent-turquoise"
        />
        <span className="text-text-muted">
          Accès à l&apos;espace personnel {actif ? "activé" : "non activé"}
          {!actif && " (s'active automatiquement dès que la candidature passe à «Retenu»)"}
        </span>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
