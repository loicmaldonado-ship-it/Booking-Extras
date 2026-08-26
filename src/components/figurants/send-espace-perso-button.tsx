"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendEspacePersoLinkBulk } from "@/lib/bookings/actions";

export function SendEspacePersoButton({
  figurantId,
  projetId,
  email,
}: {
  figurantId: string;
  projetId: string;
  email: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  if (!email) return null;

  function send() {
    setResult(null);
    startTransition(async () => {
      const res = await sendEspacePersoLinkBulk([figurantId], projetId);
      setResult(res.error ?? (res.sent ? "Lien envoyé." : res.lastError ?? "Échec de l'envoi."));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" disabled={pending} onClick={send}>
        {pending ? "Envoi..." : "Envoyer le lien de création de compte"}
      </Button>
      {result && <p className="text-xs text-text-muted">{result}</p>}
    </div>
  );
}
