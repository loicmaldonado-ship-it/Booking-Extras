"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signIn } from "@/lib/auth/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" required>
          <Input type="email" name="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Mot de passe" required>
          <Input type="password" name="password" autoComplete="current-password" required />
        </Field>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Connexion..." : "Se connecter"}
        </Button>
      </form>
    </Card>
  );
}
