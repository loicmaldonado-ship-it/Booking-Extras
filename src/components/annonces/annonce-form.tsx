"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Annonce } from "@/lib/annonces/types";

type Action = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string } | void>;

export function AnnonceForm({
  action,
  annonce,
  projets,
  defaultProjetId,
}: {
  action: Action;
  annonce?: Annonce;
  projets: { id: string; nom: string }[];
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
        <h2 className="text-lg font-semibold">Annonce</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Titre" required>
            <Input name="titre" defaultValue={annonce?.titre} required />
          </Field>
          <Field label="Projet" required>
            <Select
              name="projet_id"
              defaultValue={annonce?.projet_id ?? defaultProjetId ?? ""}
              required
            >
              <option value=""></option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date recherchée">
            <Input type="date" name="date_recherchee" defaultValue={annonce?.date_recherchee ?? ""} />
          </Field>
          <Field label="Lieu">
            <Input name="lieu" defaultValue={annonce?.lieu ?? ""} />
          </Field>
          <Field label="Statut">
            <Select name="statut" defaultValue={annonce?.statut ?? "ouverte"}>
              <option value="ouverte">Ouverte</option>
              <option value="fermée">Fermée</option>
            </Select>
          </Field>
          <Field label="Limite de candidatures (optionnel)">
            <Input
              type="number"
              min={0}
              name="limite_candidatures"
              placeholder="Illimité"
              defaultValue={annonce?.limite_candidatures ?? ""}
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea name="description" defaultValue={annonce?.description ?? ""} />
        </Field>
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="ouverte_mineurs"
            defaultChecked={annonce?.ouverte_mineurs ?? false}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Ouverte aux moins de 16 ans
        </label>
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="bande_demo_obligatoire"
            defaultChecked={annonce?.bande_demo_obligatoire ?? false}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Lien de bande démo obligatoire pour postuler
        </label>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : annonce ? "Enregistrer" : "Créer l'annonce"}
        </Button>
      </div>
    </form>
  );
}
