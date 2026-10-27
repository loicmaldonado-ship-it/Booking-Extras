"use client";

import { useEffect, useState } from "react";
import { deleteFigurant } from "@/lib/figurants/actions";

/** Two deliberate steps, plus a server-side confirmation and dependency check. */
export function DeleteFigurantConfirm({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);
  if (!open) {
    return <button type="button" className="rounded-full px-3 py-2 text-sm text-danger hover:underline" onClick={() => setOpen(true)}>
      Supprimer
    </button>;
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby={`delete-figurant-title-${id}`} className="w-full max-w-lg rounded-xl border border-danger bg-ink p-5 shadow-xl">
      <h2 id={`delete-figurant-title-${id}`} className="font-semibold text-danger">Confirmer la suppression définitive</h2>
      <p className="mt-2 text-sm">Profil : <strong>{label}</strong>. Cette action est irréversible. Les profils avec historique, photos ou candidatures ne peuvent pas être supprimés ici : utiliser le parcours RGPD.</p>
      <form action={async (data) => {
        setError(null);
        const result = await deleteFigurant(id, data);
        if (result?.error) setError(result.error);
      }} className="mt-3 flex flex-col gap-2">
        <label htmlFor={`delete-confirm-${id}`} className="text-sm">Saisis <strong>SUPPRIMER</strong> pour confirmer :</label>
        <input id={`delete-confirm-${id}`} name="confirmation" autoFocus autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="rounded-lg border border-border bg-ink-raised px-3 py-2 text-sm" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setOpen(false); setConfirmation(""); setError(null); }} className="rounded-full border border-border px-4 py-2 text-sm">Annuler</button>
          <button type="submit" disabled={confirmation !== "SUPPRIMER"} className="rounded-full border border-danger px-4 py-2 text-sm text-danger disabled:opacity-40">Supprimer définitivement</button>
        </div>
      </form>
    </section>
    </div>
  );
}
