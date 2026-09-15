"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <Card className="flex flex-col gap-2">
        <p className="text-sm">
          Si un compte existe avec cet email, un lien pour choisir un nouveau mot de passe vient d&apos;être envoyé.
        </p>
        <Link href="/login" className="text-sm text-coral hover:underline">
          ← Retour à la connexion
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Indique ton email de connexion — on t&apos;envoie un lien pour choisir un nouveau mot de passe.
        </p>
        <Field label="Email" required>
          <Input type="email" name="email" autoComplete="email" required autoFocus />
        </Field>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Envoi..." : "Envoyer le lien"}
        </Button>
        <Link href="/login" className="text-center text-sm text-text-muted hover:underline">
          ← Retour à la connexion
        </Link>
      </form>
    </Card>
  );
}
