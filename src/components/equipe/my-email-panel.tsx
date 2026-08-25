"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateMyGmailSmtp } from "@/lib/auth/email-actions";

export function MyEmailPanel({ gmailUser }: { gmailUser: string | null }) {
  const [state, formAction, pending] = useActionState(updateMyGmailSmtp, undefined);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Ta boîte d&apos;envoi Gmail</h2>
        <p className="mt-1 text-sm text-text-muted">
          Optionnel — si renseignée, tous les messages envoyés depuis tes projets (convocations, candidatures,
          casting, essayages...) partent de cette adresse au lieu de la boîte partagée par défaut. Un projet peut
          toujours définir sa propre adresse pour l&apos;écraser ponctuellement.
        </p>
      </div>
      <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Adresse Gmail">
          <Input type="email" name="gmail_smtp_user" placeholder="prenom.nom@gmail.com" defaultValue={gmailUser ?? ""} />
        </Field>
        <Field label="Mot de passe d'application">
          <Input
            type="password"
            name="gmail_smtp_app_password"
            placeholder={gmailUser ? "•••••••••••••••• (déjà enregistré)" : "16 caractères, sans espaces"}
          />
        </Field>
        <div className="flex flex-col gap-2 md:col-span-2">
          {gmailUser && (
            <p className="text-xs text-text-muted">
              Un mot de passe est déjà enregistré (chiffré) — laisse ce champ vide pour le conserver, ou ressaisis-le
              pour le remplacer. Si tu changes l&apos;adresse Gmail, ressaisis aussi le mot de passe correspondant.
            </p>
          )}
          <div className="rounded-xl border border-border bg-ink px-4 py-3 text-sm text-text-muted">
            <p className="font-medium text-text">Procédure rapide (sur ton compte Gmail) :</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Active la validation en 2 étapes si ce n&apos;est pas déjà fait.</li>
              <li>
                Va sur{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-coral hover:underline"
                >
                  myaccount.google.com/apppasswords
                </a>
                .
              </li>
              <li>Crée un mot de passe d&apos;application (nom au choix, ex. « Booking Extras »).</li>
              <li>Colle l&apos;adresse Gmail et le mot de passe généré (16 caractères) ci-dessus.</li>
            </ol>
          </div>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          {state?.success && <p className="text-sm text-turquoise">Enregistré.</p>}
          <Button type="submit" disabled={pending} className="w-full md:w-auto">
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
