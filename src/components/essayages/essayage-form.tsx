"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ESSAYAGE_STATUTS, type Essayage } from "@/lib/essayages/types";

type Action = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string } | void>;

export function EssayageForm({
  action,
  essayage,
  figurants,
  projets,
  defaultFigurantId,
  defaultProjetId,
}: {
  action: Action;
  essayage?: Essayage;
  figurants: { id: string; prenom: string; nom: string }[];
  projets: { id: string; nom: string }[];
  defaultFigurantId?: string;
  defaultProjetId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Essayage</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Figurant" required>
            <Select name="figurant_id" defaultValue={essayage?.figurant_id ?? defaultFigurantId ?? ""} required>
              <option value=""></option>
              {figurants.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Projet" required>
            <Select name="projet_id" defaultValue={essayage?.projet_id ?? defaultProjetId ?? ""} required>
              <option value=""></option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" name="date" defaultValue={essayage?.date ?? ""} />
          </Field>
          <Field label="Heure">
            <Input type="time" name="heure" defaultValue={essayage?.heure ?? ""} />
          </Field>
          <Field label="Lieu">
            <Input name="lieu" defaultValue={essayage?.lieu ?? ""} />
          </Field>
          <Field label="Statut">
            <Select name="statut" defaultValue={essayage?.statut ?? "proposé"}>
              {ESSAYAGE_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" defaultValue={essayage?.notes ?? ""} />
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : essayage ? "Enregistrer" : "Créer l'essayage"}
        </Button>
      </div>
    </form>
  );
}
