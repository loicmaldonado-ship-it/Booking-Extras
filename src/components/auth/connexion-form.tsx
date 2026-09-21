"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestMagicLink, loginWithPassword } from "@/lib/candidats/actions";

function ExpiredLinkNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "lien_invalide") return null;
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      Ce lien n&apos;est plus valide (expiré ou déjà utilisé). Demandez-en un nouveau.
    </div>
  );
}

// Deux façons de se connecter dans le même formulaire (email commun aux
// deux) : par mot de passe si tu en as défini un (après une candidature,
// voir postuler-form.tsx), sinon par lien magique comme avant — jamais
// obligatoire, juste plus rapide une fois défini. `formAction` par bouton
// (React 19) plutôt que deux <form> séparés, pour ne pas dupliquer le champ
// email.
export function ConnexionForm() {
  const [magicState, magicAction, magicPending] = useActionState(requestMagicLink, undefined);
  const [passwordState, passwordAction, passwordPending] = useActionState(loginWithPassword, undefined);
  const [password, setPassword] = useState("");

  if (magicState?.sentTo) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Email envoyé</h2>
        <p className="text-sm text-text-muted">
          Un lien de connexion vient d&apos;être envoyé à <strong>{magicState.sentTo}</strong> (valable 30
          minutes). Ouvrez-le depuis votre messagerie pour accéder à votre espace.
        </p>
      </Card>
    );
  }

  return (
    <form className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <ExpiredLinkNotice />
      </Suspense>
      {magicState?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {magicState.error}
        </div>
      )}
      {passwordState?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {passwordState.error}
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <Field label="Email" required>
          <Input type="email" name="email" required autoFocus placeholder="vous@exemple.com" />
        </Field>
        <Field label="Mot de passe (si tu en as défini un)">
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Optionnel"
            autoComplete="current-password"
          />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" formAction={passwordAction} disabled={passwordPending || !password} className="flex-1">
            {passwordPending ? "..." : "Se connecter"}
          </Button>
          <Button
            type="submit"
            formAction={magicAction}
            variant="secondary"
            disabled={magicPending}
            className="flex-1"
          >
            {magicPending ? "Envoi..." : "Recevoir mon lien par email"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
