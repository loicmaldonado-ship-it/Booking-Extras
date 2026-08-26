"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateMyEmailTemplates } from "@/lib/auth/email-actions";

export function MyEmailTemplatesPanel({
  espacePerso,
  magicLink,
}: {
  espacePerso: string | null;
  magicLink: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateMyEmailTemplates, undefined);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Mails automatiques</h2>
        <p className="mt-1 text-sm text-text-muted">
          Optionnel — calibre le texte envoyé automatiquement pour l&apos;activation de l&apos;espace perso et le
          renvoi du lien de connexion. Laisse vide pour garder le texte par défaut. Tokens disponibles :{" "}
          <code className="text-coral">{"{prenom}"}</code> et <code className="text-coral">{"{lien}"}</code>{" "}
          (obligatoire).
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email d'activation de l'espace personnel">
          <textarea
            name="email_espace_perso_template"
            defaultValue={espacePerso ?? ""}
            rows={5}
            placeholder={
              "Vide = message par défaut. Ex. « Bonjour {prenom}, votre espace est prêt : {lien} »"
            }
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
        </Field>
        <Field label="Email de renvoi du lien de connexion">
          <textarea
            name="email_magic_link_template"
            defaultValue={magicLink ?? ""}
            rows={5}
            placeholder={
              "Vide = message par défaut. Ex. « Bonjour {prenom}, voici votre lien : {lien} »"
            }
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
        </Field>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-turquoise">Enregistré.</p>}
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Card>
  );
}
