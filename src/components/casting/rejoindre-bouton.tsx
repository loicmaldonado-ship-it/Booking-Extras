"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { rejoindreCasting } from "@/lib/casting/rejoindre-actions";

export function RejoindreBouton({ token, libelle }: { token: string; libelle: string }) {
  const [state, action, pending] = useActionState(async () => rejoindreCasting(token), undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Un instant…" : libelle}
      </Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
