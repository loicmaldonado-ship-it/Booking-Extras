"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createProjetIndemnite, deleteProjetIndemnite } from "@/lib/indemnites/actions";
import type { ProjetIndemnite } from "@/lib/indemnites/types";

// Édition d'un projet déjà créé : chaque ajout/suppression touche
// directement la base (contrairement à IndemniteListEditor, utilisé à la
// création quand le projet n'a pas encore d'id).
export function IndemnitesManager({ projetId, indemnites }: { projetId: string; indemnites: ProjetIndemnite[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [montant, setMontant] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    const n = Number(montant);
    if (!label.trim() || !Number.isFinite(n)) return;
    startTransition(async () => {
      const result = await createProjetIndemnite(projetId, label, n);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setLabel("");
      setMontant("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteProjetIndemnite(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {indemnites.length > 0 && (
        <div className="flex flex-col gap-2">
          {indemnites.map((ind) => (
            <div
              key={ind.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-ink px-3 py-2 text-sm"
            >
              <span>
                {ind.label} — <span className="text-turquoise">{ind.montant.toFixed(2)} €</span>
              </span>
              <button
                type="button"
                onClick={() => remove(ind.id)}
                disabled={pending}
                className="text-text-muted hover:text-coral disabled:opacity-60"
                title="Supprimer cette indemnité"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex. Prime nuit"
          disabled={pending}
          className="flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <input
          type="number"
          step="0.5"
          min={0}
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder="Montant €"
          disabled={pending}
          className="w-32 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <Button type="button" variant="secondary" onClick={add} disabled={pending || !label.trim() || montant.trim() === ""}>
          {pending ? "Ajout..." : "+ Ajouter"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
