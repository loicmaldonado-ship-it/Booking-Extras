"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleAccesCompte } from "@/lib/candidats/actions";

export function AccesCompteToggle({
  figurantId,
  actif,
  projetId,
  peutRevoquer = false,
}: {
  figurantId: string;
  actif: boolean;
  projetId?: string | null;
  // Réservé aux comptes à accès complet (Loïc, Mathieu, Eléa).
  peutRevoquer?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(value: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleAccesCompte(figurantId, value, projetId);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">
          Accès à l&apos;espace personnel : {actif ? "activé" : "non activé"}
        </span>
        {actif ? (
          peutRevoquer && (
          <button type="button" onClick={() => toggle(false)} disabled={pending} className="text-xs text-danger hover:underline">
            Révoquer
          </button>
          )
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
