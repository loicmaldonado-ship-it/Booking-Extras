"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { anonymiserFigurant } from "@/lib/rgpd/actions";

export function AnonymiserButton({ figurantId, nom, effacementEnCours = false }: { figurantId: string; nom: string; effacementEnCours?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function anonymiser() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await anonymiserFigurant(figurantId);
        if ("error" in result && result.error) { setError(result.error); setConfirming(false); if (result.refresh) router.refresh(); return; }
        router.refresh();
      } catch {
        setError("Nettoyage interrompu. Aucune réussite confirmée. Réessaie.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Confirmer ?</span>
        <Button type="button" variant="secondary" disabled={pending} onClick={anonymiser}>
          {pending ? "..." : "Oui, anonymiser"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="ghost" onClick={() => { setError(null); if (effacementEnCours) anonymiser(); else setConfirming(true); }} title={`Anonymiser ${nom}`}>{effacementEnCours ? "Reprendre le nettoyage" : "Anonymiser"}</Button>
      {error && <p role="alert" className="max-w-sm text-sm text-danger">{error}</p>}
    </div>
  );
}
