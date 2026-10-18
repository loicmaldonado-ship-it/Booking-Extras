"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmerReception } from "@/lib/messages/envois-actions";

export function BienRecuBouton({ token, dejaConfirme }: { token: string; dejaConfirme: boolean }) {
  const [fait, setFait] = useState(dejaConfirme);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  if (fait) {
    return <p className="rounded-xl bg-turquoise/15 px-4 py-3 text-center font-medium text-turquoise">✓ Merci, c&apos;est noté !</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          demarrer(async () => {
            const res = await confirmerReception(token);
            if (res.error) setErreur(res.error);
            else setFait(true);
          })
        }
        className="w-full py-3 text-base"
      >
        {pending ? "…" : "👍 Bien reçu"}
      </Button>
      {erreur && <p className="text-sm text-danger">{erreur}</p>}
    </div>
  );
}
