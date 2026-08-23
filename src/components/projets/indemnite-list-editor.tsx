"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { label: string; montant: number };

// Création d'un projet : le projet n'a pas encore d'id, donc la liste vit en
// local (préremplie avec les indemnités du dernier projet) et part avec le
// reste du formulaire via le champ caché "indemnites" (JSON).
export function IndemniteListEditor({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [label, setLabel] = useState("");
  const [montant, setMontant] = useState("");

  function add() {
    const n = Number(montant);
    if (!label.trim() || !Number.isFinite(n)) return;
    setItems((prev) => [...prev, { label: label.trim(), montant: n }]);
    setLabel("");
    setMontant("");
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="indemnites" value={JSON.stringify(items)} />
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((ind, i) => (
            <div
              key={`${ind.label}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-ink px-3 py-2 text-sm"
            >
              <span>
                {ind.label} — <span className="text-turquoise">{ind.montant.toFixed(2)} €</span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-text-muted hover:text-coral"
                title="Retirer cette indemnité"
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
          className="flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
        <input
          type="number"
          step="0.5"
          min={0}
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder="Montant €"
          className="w-32 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!label.trim() || montant.trim() === ""}>
          + Ajouter
        </Button>
      </div>
    </div>
  );
}
