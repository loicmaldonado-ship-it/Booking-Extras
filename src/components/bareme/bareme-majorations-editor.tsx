"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { createBaremeMajoration, deleteBaremeMajoration, updateBaremeMajoration } from "@/lib/bareme/actions";
import { formatMajorationValeur, type BaremeMajoration, type MajorationValeurType } from "@/lib/bareme/types";
import type { Convention } from "@/lib/projets/types";

const VALEUR_TYPES: { value: MajorationValeurType; label: string }[] = [
  { value: "pourcentage", label: "% (fixe)" },
  { value: "montant_fixe", label: "Montant fixe (€)" },
  { value: "cachet_double", label: "Cachet doublé" },
  { value: "pourcentage_remuneration", label: "% de la rémunération" },
  { value: "pourcentage_salaire_jour", label: "% du salaire journalier" },
];

function MajorationRow({ majoration, isChef }: { majoration: BaremeMajoration; isChef: boolean }) {
  const router = useRouter();
  const [valeur, setValeur] = useState(majoration.valeur != null ? String(majoration.valeur) : "");
  const [notes, setNotes] = useState(majoration.notes ?? "");
  const [pending, startTransition] = useTransition();
  const valeurDisabled = majoration.valeur_type === "cachet_double";

  function save() {
    const n = valeur.trim() === "" ? null : Number(valeur);
    if (n !== null && !Number.isFinite(n)) return;
    startTransition(async () => {
      await updateBaremeMajoration(majoration.id, n, notes.trim() || null);
      router.refresh();
    });
  }

  if (!isChef) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-6 py-3">
          {majoration.label}
          {majoration.cinema_uniquement && (
            <Badge tone="yellow" className="ml-2">
              Cinéma uniquement
            </Badge>
          )}
        </td>
        <td className="px-6 py-3 text-turquoise">{formatMajorationValeur(majoration)}</td>
        <td className="px-6 py-3 text-text-muted">{majoration.notes ?? "—"}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-6 py-3">
        {majoration.label}
        {majoration.cinema_uniquement && (
          <Badge tone="yellow" className="ml-2">
            Cinéma uniquement
          </Badge>
        )}
      </td>
      <td className="px-3 py-2">
        {valeurDisabled ? (
          <span className="text-sm text-text-muted">Cachet doublé</span>
        ) : (
          <input
            type="number"
            step="0.1"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            onBlur={save}
            disabled={pending}
            className="w-24 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm text-turquoise outline-none focus:border-coral disabled:opacity-60"
          />
        )}
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
                await deleteBaremeMajoration(majoration.id);
                router.refresh();
              });
            }}
            disabled={pending}
            className="text-text-muted hover:text-coral disabled:opacity-60"
            title="Supprimer cette majoration"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddMajorationRow({ convention }: { convention: Convention }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createBaremeMajoration, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <tr className="border-b border-border last:border-0 bg-ink/40">
      <td colSpan={3} className="px-6 py-3">
        <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="convention" value={convention} />
          <input
            type="text"
            name="label"
            required
            placeholder="Libellé (ex. Nuit)"
            className="w-40 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          />
          <select
            name="valeur_type"
            defaultValue="pourcentage"
            className="rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          >
            {VALEUR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            name="valeur"
            placeholder="Valeur (ignoré si cachet doublé)"
            className="w-48 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          />
          <label className="flex items-center gap-1.5 text-xs text-text-muted">
            <input type="checkbox" name="cinema_uniquement" className="h-4 w-4 rounded border-border accent-coral" />
            Cinéma uniquement
          </label>
          <input
            type="text"
            name="notes"
            placeholder="Notes (optionnel)"
            className="flex-1 rounded-lg border border-border bg-ink px-2 py-1.5 text-sm outline-none focus:border-coral"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Ajout..." : "+ Ajouter une majoration"}
          </Button>
        </form>
        {state?.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      </td>
    </tr>
  );
}

export function BaremeMajorationsEditor({
  convention,
  majorations,
  isChef,
}: {
  convention: Convention;
  majorations: BaremeMajoration[];
  isChef: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-text-muted">
          <th className="px-6 py-3 font-medium">Majoration</th>
          <th className="px-6 py-3 font-medium">Valeur</th>
          <th className="px-6 py-3 font-medium">Notes</th>
        </tr>
      </thead>
      <tbody>
        {majorations.map((m) => (
          <MajorationRow key={m.id} majoration={m} isChef={isChef} />
        ))}
        {isChef && <AddMajorationRow convention={convention} />}
      </tbody>
    </table>
  );
}
