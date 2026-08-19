"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { updateCandidature } from "@/lib/candidatures/actions";
import { CACHETS, CANDIDATURE_STATUTS, type Cachet, type CandidatureStatut } from "@/lib/candidatures/types";

export function CandidatureRow({
  id,
  statut,
  fonctionAssignee,
  cachetAssigne,
}: {
  id: string;
  statut: CandidatureStatut;
  fonctionAssignee: string | null;
  cachetAssigne: Cachet | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updateCandidature(id, formData))}
      className="flex flex-wrap items-center gap-2"
    >
      <Select name="statut" defaultValue={statut} className="w-36">
        {CANDIDATURE_STATUTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Input
        name="fonction_assignee"
        placeholder="Fonction (passant...)"
        defaultValue={fonctionAssignee ?? ""}
        className="w-40"
      />
      <Select name="cachet_assigne" defaultValue={cachetAssigne ?? ""} className="w-40">
        <option value="">Cachet</option>
        {CACHETS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "..." : "Enregistrer"}
      </Button>
    </form>
  );
}
