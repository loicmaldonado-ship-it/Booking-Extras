"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { setMaPassword } from "@/lib/candidats/actions";

// SEC-02 (30/10/2026) : une candidate reconnectée par lien (mot de passe oublié) peut enfin définir un nouveau mot de
// passe ; l'action existait mais n'était branchée sur aucun écran.
export function MotDePasseForm() {
  const [state, action, pending] = useActionState(setMaPassword, {});
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Mot de passe</h2>
      <p className="text-sm text-text-muted">Choisis un nouveau mot de passe (au moins 8 caractères), par exemple après un oubli.</p>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Nouveau mot de passe" required>
          <Input type="password" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirmer le mot de passe" required>
          <Input type="password" name="password_confirmation" autoComplete="new-password" minLength={8} required />
        </Field>
        <div>
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Changer mon mot de passe"}</Button>
        </div>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p role="status" className="text-sm text-turquoise">Mot de passe modifié.</p>}
      </form>
    </Card>
  );
}
