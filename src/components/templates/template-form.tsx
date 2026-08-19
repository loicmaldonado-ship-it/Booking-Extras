"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { createTemplate } from "@/lib/templates/actions";

export function TemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <Field label="Nom du modèle" required>
        <Input name="nom" required placeholder="Ex. Relance sans réponse" />
      </Field>
      <Field label="Sujet" required>
        <Input name="sujet" required placeholder="Ex. On a besoin de ta réponse !" />
      </Field>
      <Field label="Corps du message" required>
        <Textarea name="corps" required rows={5} placeholder={"Bonjour {prenom},\n\n..."} />
      </Field>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer le modèle"}
        </Button>
      </div>
    </form>
  );
}
