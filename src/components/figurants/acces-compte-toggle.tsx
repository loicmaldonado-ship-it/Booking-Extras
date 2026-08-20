"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleAccesCompte } from "@/lib/candidats/actions";

export function AccesCompteToggle({ figurantId, actif }: { figurantId: string; actif: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(value: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleAccesCompte(figurantId, value);
      if (result && "emailError" in result && result.emailError) {
        setError(`Accès activé, mais l'email n'a pas pu être envoyé : ${result.emailError}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">
          Accès à l&apos;espace personnel : {actif ? "activé" : "non activé"}
          {!actif && " (s'active automatiquement quand le profil est transféré dans une journée)"}
        </span>
        {actif ? (
          <button type="button" onClick={() => toggle(false)} disabled={pending} className="text-xs text-danger hover:underline">
            Révoquer
          </button>
        ) : (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => toggle(true)}>
            {pending ? "Envoi..." : "Envoyer le lien"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
