"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { updateCandidature } from "@/lib/candidatures/actions";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { OngletPicker } from "@/components/candidatures/onglet-picker";
import type { CandidatureOnglet } from "@/lib/candidatures/types";

export function CandidatureRow({
  id,
  ongletId,
  onglets,
  fonctionAssignee,
  cachetAssigne,
}: {
  id: string;
  ongletId: string | null;
  onglets: CandidatureOnglet[];
  fonctionAssignee: string | null;
  cachetAssigne: Cachet | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <OngletPicker candidatureId={id} ongletId={ongletId} onglets={onglets} />
      <form
        action={(formData) => startTransition(() => updateCandidature(id, formData))}
        className="flex flex-wrap items-center gap-2"
      >
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
    </div>
  );
}
