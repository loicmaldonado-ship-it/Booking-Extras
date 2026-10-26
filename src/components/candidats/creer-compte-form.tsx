"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { creerCompteDepuisInvitation } from "@/lib/candidats/creer-compte";

export function CreerCompteForm({
  token,
  email,
  retour,
  min,
}: {
  token: string;
  email: string | null;
  retour: string | null;
  min: number;
}) {
  const [state, action, pending] = useActionState(creerCompteDepuisInvitation.bind(null, token), undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {retour && <input type="hidden" name="retour" value={retour} />}
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</div>
      )}
      <Card className="flex flex-col gap-4">
        {email && (
          <Field label="Ton email (pour te connecter)">
            <Input type="email" value={email} readOnly autoComplete="username" />
          </Field>
        )}
        <Field label={`Mot de passe (au moins ${min} caractères)`} required>
          <Input type="password" name="password" required minLength={min} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirme le mot de passe" required>
          <Input type="password" name="password_confirmation" required minLength={min} autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </Card>
    </form>
  );
}
