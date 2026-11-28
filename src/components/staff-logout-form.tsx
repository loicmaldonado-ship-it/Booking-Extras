"use client";

import { useActionState } from "react";
import { signOut } from "@/lib/auth/actions";

export function StaffLogoutForm({ mobile = false }: { mobile?: boolean }) {
  const [state, action, pending] = useActionState(signOut, { error: "" });
  return (
    <form action={action} className={mobile ? "border-t border-border pt-2 lg:hidden" : "hidden lg:block"}>
      <button type="submit" disabled={pending} className={mobile ? "w-full rounded-lg border border-border-strong px-3 py-1.5 text-left text-xs font-medium text-text hover:border-coral/60 hover:text-text" : "rounded-xl border border-border-strong px-3 py-2 text-sm font-medium text-text transition-colors hover:border-coral/60 hover:text-text"}>
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </button>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
