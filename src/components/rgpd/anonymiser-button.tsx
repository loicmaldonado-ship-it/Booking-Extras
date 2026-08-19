"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { anonymiserFigurant } from "@/lib/rgpd/actions";

export function AnonymiserButton({ figurantId, nom }: { figurantId: string; nom: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function anonymiser() {
    startTransition(async () => {
      await anonymiserFigurant(figurantId);
      router.refresh();
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
    <Button type="button" variant="ghost" onClick={() => setConfirming(true)} title={`Anonymiser ${nom}`}>
      Anonymiser
    </Button>
  );
}
