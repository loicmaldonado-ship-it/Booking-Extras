"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addIndisponibiliteSelf, removeIndisponibiliteSelf } from "@/lib/candidats/actions";
import { formatDateShort } from "@/lib/format-date";

export type Indisponibilite = { date: string; motif: string | null };

export function IndisponibilitesPanel({ indisponibilites }: { indisponibilites: Indisponibilite[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = indisponibilites.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  function add(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addIndisponibiliteSelf(undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  function remove(date: string) {
    startTransition(async () => {
      await removeIndisponibiliteSelf(date);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mes indisponibilités</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-coral hover:underline">
            + Ajouter une date
          </button>
        )}
      </div>

      {upcoming.length === 0 && !adding && (
        <p className="text-sm text-text-muted">Aucune date d&apos;indisponibilité déclarée.</p>
      )}

      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {upcoming.map((i) => (
            <li key={i.date} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {formatDateShort(i.date)}
                {i.motif && <span className="text-text-muted"> — {i.motif}</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(i.date)}
                className="text-xs text-text-muted hover:text-danger"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form action={add} className="flex flex-col gap-2 border-t border-border pt-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <Input type="date" name="date" required min={today} />
            </Field>
            <Field label="Projet / motif (optionnel)">
              <Input name="motif" placeholder="Ex. déjà engagé·e sur [projet]" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
