"use client";

import { useActionState } from "react";
import { createJournee } from "@/lib/bookings/actions";

export function CreateJourneeForm({ projetId }: { projetId: string }) {
  const [state, action, pending] = useActionState(createJournee.bind(null, projetId), { error: "" });
  return (
    <form action={action} className="flex aspect-square w-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-3 text-center">
      <span className="text-sm font-medium text-text-muted">+ Créer journée</span>
      <input type="date" name="date" required aria-label="Date de la journée" className="w-full rounded-md border border-border bg-ink-raised-2 px-2 py-1.5 text-sm" />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-ink-raised-2 px-4 py-1.5 text-sm font-medium hover:border hover:border-coral/60">{pending ? "Création…" : "Créer"}</button>
    </form>
  );
}
