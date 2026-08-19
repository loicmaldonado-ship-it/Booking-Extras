"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { updateTemplate, deleteTemplate } from "@/lib/templates/actions";
import type { MessageTemplate } from "@/lib/templates/types";

function TemplateRow({ template }: { template: MessageTemplate }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const boundUpdate = updateTemplate.bind(null, template.id);
  const [state, formAction, submitting] = useActionState(boundUpdate, undefined);

  useEffect(() => {
    async function closeOnSuccess() {
      if (state?.success) setEditing(false);
    }
    closeOnSuccess();
  }, [state]);

  function remove() {
    startTransition(async () => {
      await deleteTemplate(template.id);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <Card className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{template.nom}</h3>
            <p className="text-sm text-text-muted">{template.sujet}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Modifier
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              Supprimer
            </Button>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-text-muted">{template.corps}</p>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        <Field label="Nom du modèle" required>
          <Input name="nom" required defaultValue={template.nom} />
        </Field>
        <Field label="Sujet" required>
          <Input name="sujet" required defaultValue={template.sujet} />
        </Field>
        <Field label="Corps du message" required>
          <Textarea name="corps" required rows={5} defaultValue={template.corps} />
        </Field>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TemplatesList({ templates }: { templates: MessageTemplate[] }) {
  if (templates.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-muted">Aucun modèle pour l&apos;instant.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((t) => (
        <TemplateRow key={t.id} template={t} />
      ))}
    </div>
  );
}
