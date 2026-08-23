"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBaremeCachet, deleteBaremeCachet, updateBaremeCachet } from "@/lib/bareme/actions";
import type { BaremeCachet } from "@/lib/bareme/types";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import type { Convention } from "@/lib/projets/types";

function CachetRow({ cachet, isChef }: { cachet: BaremeCachet; isChef: boolean }) {
  const router = useRouter();
  const [montant, setMontant] = useState(String(cachet.montant_brut));
  const [notes, setNotes] = useState(cachet.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const n = Number(montant);
    if (!Number.isFinite(n)) return;
    startTransition(async () => {
      await updateBaremeCachet(cachet.id, n, notes.trim() || null);
      router.refresh();
    });
  }

  if (!isChef) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-6 py-3 font-medium">{cachet.cachet}</td>
        <td className="px-6 py-3 text-turquoise">{cachet.montant_brut.toFixed(2)} €</td>
        <td className="px-6 py-3 text-text-muted">{cachet.notes ?? "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-6 py-3 font-medium">{cachet.cachet}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.5"
          min={0}
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          onBlur={save}
          disabled={pending}
          className="w-24 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm text-turquoise outline-none focus:border-coral disabled:opacity-60"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={save}
            disabled={pending}
            placeholder="—"
            className="flex-1 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => {
              startTransition(async () => {
                await deleteBaremeCachet(cachet.id);
                router.refresh();
              });
            }}
            disabled={pending}
            className="text-text-muted hover:text-coral disabled:opacity-60"
            title="Supprimer ce tarif"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddCachetRow({ convention, availableCachets }: { convention: Convention; availableCachets: Cachet[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createBaremeCachet, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  if (availableCachets.length === 0) return null;

  return (
    <tr className="border-b border-border last:border-0 bg-ink/40">
      <td colSpan={3} className="px-6 py-3">
        <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="convention" value={convention} />
          <select
            name="cachet"
            required
            defaultValue=""
            className="rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          >
            <option value="" disabled>
              Cachet…
            </option>
            {availableCachets.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.5"
            min={0}
            name="montant_brut"
            required
            placeholder="Montant €"
            className="w-28 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          />
          <input
            type="text"
            name="notes"
            placeholder="Notes (optionnel)"
            className="flex-1 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Ajout..." : "+ Ajouter un tarif"}
          </Button>
        </form>
        {state?.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      </td>
    </tr>
  );
}

export function BaremeCachetsEditor({
  convention,
  cachets,
  isChef,
}: {
  convention: Convention;
  cachets: BaremeCachet[];
  isChef: boolean;
}) {
  const usedCachets = new Set(cachets.map((c) => c.cachet));
  const availableCachets = CACHETS.filter((c) => !usedCachets.has(c));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-text-muted">
          <th className="px-6 py-3 font-medium">Cachet</th>
          <th className="px-6 py-3 font-medium">Montant brut</th>
          <th className="px-6 py-3 font-medium">Notes</th>
        </tr>
      </thead>
      <tbody>
        {cachets.map((c) => (
          <CachetRow key={c.id} cachet={c} isChef={isChef} />
        ))}
        {isChef && <AddCachetRow convention={convention} availableCachets={availableCachets} />}
      </tbody>
    </table>
  );
}
