"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resendChefInvite } from "@/lib/admin/actions";

export function ResendInviteButton({ chefId }: { chefId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function resend() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const result = await resendChefInvite(chefId);
      if (result?.error) setError(result.error);
      else setSent(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" disabled={pending} onClick={resend}>
        {pending ? "Envoi..." : "Renvoyer l'invitation"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {sent && <p className="text-xs text-turquoise">Invitation renvoyée.</p>}
    </div>
  );
}
