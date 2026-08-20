"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CONVENTIONS, PROJET_TYPES, type Projet } from "@/lib/projets/types";

type Action = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string } | void>;

export function ProjetForm({
  action,
  projet,
}: {
  action: Action;
  projet?: Projet;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Identité du projet</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom du projet" required>
            <Input name="nom" defaultValue={projet?.nom} required />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={projet?.type ?? ""}>
              <option value=""></option>
              {PROJET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Convention" required>
            <Select name="convention" defaultValue={projet?.convention ?? ""}>
              <option value=""></option>
              {CONVENTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Réalisateur·ice">
            <Input name="realisateur" defaultValue={projet?.realisateur ?? ""} />
          </Field>
          <Field label="Société de production">
            <Input name="societe_production" defaultValue={projet?.societe_production ?? ""} />
          </Field>
          <Field label="Diffuseur / chaîne">
            <Input name="diffuseur" defaultValue={projet?.diffuseur ?? ""} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="confidentiel"
            defaultChecked={projet?.confidentiel}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Projet confidentiel
        </label>
        <Field label="Nom de code (affiché au public à la place du vrai nom)">
          <Input name="nom_code" placeholder="Ex. Projet Écureuil" defaultValue={projet?.nom_code ?? ""} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tournage</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Début du tournage">
            <Input type="date" name="date_debut" defaultValue={projet?.date_debut ?? ""} />
          </Field>
          <Field label="Fin du tournage">
            <Input type="date" name="date_fin" defaultValue={projet?.date_fin ?? ""} />
          </Field>
          <Field label="Lieu">
            <Input name="lieu" defaultValue={projet?.lieu ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contact projet</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Nom">
            <Input name="contact_nom" defaultValue={projet?.contact_nom ?? ""} />
          </Field>
          <Field label="Téléphone">
            <Input type="tel" name="contact_telephone" defaultValue={projet?.contact_telephone ?? ""} />
          </Field>
          <Field label="Email">
            <Input type="email" name="contact_email" defaultValue={projet?.contact_email ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Figuration</h2>
        <Field label="Besoins figuration">
          <Textarea name="besoins_figuration" defaultValue={projet?.besoins_figuration ?? ""} />
        </Field>
        <Field label="Synopsis">
          <Textarea name="synopsis" defaultValue={projet?.synopsis ?? ""} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Signature</h2>
        <p className="text-sm text-text-muted">
          Ajoutée automatiquement au bas des convocations et des modèles de message pour ce projet
          (utilise le token <code className="text-coral">{"{signature}"}</code> dans un modèle pour l&apos;insérer).
        </p>
        <Field label="Signature">
          <Textarea
            name="signature"
            rows={4}
            placeholder={"Loïc MALDONADO ACFDA\nChargé de Casting Rôle & Figuration\n06 59 04 98 36"}
            defaultValue={projet?.signature ?? ""}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Envoi des emails</h2>
          <p className="mt-1 text-sm text-text-muted">
            Optionnel — si renseigné, tous les messages envoyés depuis ce projet (convocations, candidatures,
            essayages...) partent de cette adresse au lieu de l&apos;adresse Gmail par défaut de Booking Extras.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Adresse Gmail">
            <Input
              type="email"
              name="gmail_smtp_user"
              placeholder="casting.projet@gmail.com"
              defaultValue={projet?.gmail_smtp_user ?? ""}
            />
          </Field>
          <Field label="Mot de passe d'application">
            <Input
              type="password"
              name="gmail_smtp_app_password"
              placeholder={projet?.gmail_smtp_app_password ? "•••••••••••••••• (déjà enregistré)" : "16 caractères, sans espaces"}
            />
          </Field>
        </div>
        {projet?.gmail_smtp_app_password && (
          <p className="text-xs text-text-muted">
            Un mot de passe est déjà enregistré (chiffré) pour ce projet — laisse ce champ vide pour le conserver, ou
            ressaisis-le pour le remplacer. Si tu changes l&apos;adresse Gmail, ressaisis aussi le mot de passe
            correspondant.
          </p>
        )}
        <div className="rounded-xl border border-border bg-ink px-4 py-3 text-sm text-text-muted">
          <p className="font-medium text-text">Procédure rapide (sur le compte Gmail du projet) :</p>
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
            <li>Crée un mot de passe d&apos;application (nom au choix, ex. &laquo; Booking Extras &raquo;).</li>
            <li>Colle l&apos;adresse Gmail et le mot de passe généré (16 caractères) ci-dessus.</li>
          </ol>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : projet ? "Enregistrer" : "Créer le projet"}
        </Button>
      </div>
    </form>
  );
}
