"use client";

import { Suspense, useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestMagicLink } from "@/lib/candidats/actions";

function ExpiredLinkNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "lien_invalide") return null;
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      Ce lien n&apos;est plus valide (expiré ou déjà utilisé). Demandez-en un nouveau.
    </div>
  );
}

function ConnexionForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, undefined);

  useEffect(() => {
    if (state?.mailtoUrl) {
      window.location.href = state.mailtoUrl;
    }
  }, [state?.mailtoUrl]);

  if (state?.sentTo) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Lien prêt à être envoyé</h2>
        <p className="text-sm text-text-muted">
          Votre messagerie a dû s&apos;ouvrir avec un message pré-rempli contenant votre lien de connexion.
          Envoyez-le vous-même à <strong>{state.sentTo}</strong>, puis ouvrez le lien reçu dans cet email
          (valable 30 minutes).
        </p>
        <p className="text-xs text-text-muted">
          Rien ne s&apos;est ouvert ?{" "}
          <a href={state.mailtoUrl} className="text-coral hover:underline">
            Cliquez ici
          </a>
          .
        </p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <ExpiredLinkNotice />
      </Suspense>
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <Field label="Email" required>
          <Input type="email" name="email" required autoFocus placeholder="vous@exemple.com" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi..." : "Recevoir mon lien de connexion"}
        </Button>
      </Card>
    </form>
  );
}

export default function ConnexionCandidatPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Mon espace</h1>
        <p className="mt-1 text-text-muted">
          Recevez un lien de connexion par email, sans mot de passe.
        </p>
      </div>

      <ConnexionForm />
    </div>
  );
}
