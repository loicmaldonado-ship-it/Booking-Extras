"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mergeFigurants } from "@/lib/figurants/actions";
import type { PossibleDuplicate } from "@/lib/figurants/duplicates";

const REASON_LABEL: Record<PossibleDuplicate["reason"], string> = {
  telephone: "même numéro de téléphone",
  date_naissance_nom: "même date de naissance, nom proche",
};

export function DuplicateWarning({
  figurantId,
  figurantNom,
  duplicates,
}: {
  figurantId: string;
  figurantNom: string;
  duplicates: PossibleDuplicate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function merge(keepId: string, mergeId: string, label: string) {
    if (
      !window.confirm(
        `Fusionner avec « ${label} » ? Toutes les candidatures, bookings, essayages et messages seront réunis sur une seule fiche, l'autre sera supprimée. Cette action est irréversible.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await mergeFigurants(keepId, mergeId);
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  const visible = duplicates.filter((d) => !dismissed.has(d.figurant.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      {visible.map((d) => (
        <Card key={d.figurant.id} className="flex flex-col gap-2 border-yellow/50 bg-yellow/10">
          <p className="text-sm">
            <Badge tone="yellow">Doublon possible</Badge>{" "}
            Ressemble à <strong>
              {d.figurant.prenom} {d.figurant.nom}
            </strong>{" "}
            ({REASON_LABEL[d.reason]})
            {d.figurant.ville ? ` · ${d.figurant.ville}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => merge(figurantId, d.figurant.id, `${d.figurant.prenom} ${d.figurant.nom}`)}
            >
              Garder « {figurantNom} »
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => merge(d.figurant.id, figurantId, figurantNom)}
            >
              Garder « {d.figurant.prenom} {d.figurant.nom} »
            </Button>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set([...prev, d.figurant.id]))}
              className="text-xs text-text-muted hover:text-text"
            >
              Ce n&apos;est pas la même personne
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
