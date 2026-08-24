"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { inviteChef } from "@/lib/admin/actions";

export function InviteChefForm() {
  const [state, formAction, pending] = useActionState(inviteChef, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
      <Field label="Email de la nouvelle chef·fe" required>
        <Input type="email" name="email" required placeholder="prenom@exemple.com" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? "Invitation..." : "Inviter"}
        </Button>
      </div>
      {state?.error && <p className="md:col-span-2 text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="md:col-span-2 text-sm text-turquoise">
          Compte chef·fe créé. Si c&apos;est une nouvelle personne, une invitation par email lui a été envoyée.
        </p>
      )}
    </form>
  );
}
