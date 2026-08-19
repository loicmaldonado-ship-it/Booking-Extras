"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { inviteAssistant } from "@/lib/equipe/actions";

export function InviteAssistantForm({ projets }: { projets: { id: string; nom: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteAssistant, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
      <Field label="Projet" required>
        <Select name="projet_id" required defaultValue="">
          <option value="" disabled>
            Choisir un projet
          </option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Email de l'assistant·e" required>
        <Input type="email" name="email" required placeholder="prenom@exemple.com" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? "Invitation..." : "Inviter"}
        </Button>
      </div>
      {state?.error && <p className="md:col-span-3 text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="md:col-span-3 text-sm text-turquoise">
          Accès accordé. Si c&apos;est une nouvelle personne, une invitation par email lui a été envoyée.
        </p>
      )}
    </form>
  );
}
