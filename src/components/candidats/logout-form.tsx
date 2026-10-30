"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { logoutFigurant } from "@/lib/candidats/actions";

export function LogoutForm() {
  const [state, action, pending] = useActionState(logoutFigurant, { error: "" });
  return (
    <form action={action}>
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
