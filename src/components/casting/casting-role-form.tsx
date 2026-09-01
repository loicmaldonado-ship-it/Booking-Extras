"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { createCastingRole, updateCastingRoleCalibration } from "@/lib/casting/actions";
import { CATEGORIE_CACHET_LABELS, type CastingRole } from "@/lib/casting/types";

const DEFAULT_LABELS = ["Portrait", "Pied", "Autre"];

export function CastingRoleForm({
  projetId,
  role,
  onDone,
}: {
  projetId: string;
  role?: CastingRole;
  onDone?: () => void;
}) {
  const action = role ? updateCastingRoleCalibration.bind(null, role.id) : createCastingRole.bind(null, projetId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [labels, setLabels] = useState<string[]>(role?.photo_labels ?? DEFAULT_LABELS);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    // Un nouveau rôle vient d'être créé : on referme le formulaire côté
    // parent plutôt que de laisser un formulaire vide affiché.
    if (state?.success && !role) onDone?.();
  }, [state, role, onDone]);

  function addLabel() {
    const v = labelInput.trim();
    if (!v || labels.includes(v)) return;
    setLabels((prev) => [...prev, v]);
    setLabelInput("");
  }

  function removeLabel(l: string) {
    setLabels((prev) => prev.filter((x) => x !== l));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && role && <p className="text-sm text-turquoise">Rôle mis à jour.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nom du rôle" required>
          <Input name="nom" required defaultValue={role?.nom} placeholder="Boulanger, Silhouettes marché..." />
        </Field>
        <Field label="Journée de tournage (optionnel)">
          <Input type="date" name="date_tournage" defaultValue={role?.date_tournage ?? ""} />
        </Field>
      </div>

      <Field label="Catégorie de cachet" required>
        <Select name="categorie_cachet" required defaultValue={role?.categorie_cachet ?? "role"}>
          {Object.entries(CATEGORIE_CACHET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nombre de vidéos demandées">
        <Input type="number" name="nb_videos" min={0} defaultValue={role?.nb_videos ?? 1} className="w-24" />
      </Field>

      <Field label="Photos demandées (nom du matériau)">
        <div className="flex flex-col gap-2">
          {labels.map((l) => (
            <div key={l} className="flex items-center gap-2">
              <input type="hidden" name="photo_label" value={l} />
              <span className="flex-1 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm">{l}</span>
              <button
                type="button"
                onClick={() => removeLabel(l)}
                className="text-xs text-text-muted hover:text-danger"
              >
                Retirer
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Ex. Photo pied"
              className="flex-1 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
            />
            <Button type="button" variant="ghost" onClick={addLabel} disabled={!labelInput.trim()}>
              + Ajouter
            </Button>
          </div>
        </div>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="demande_bande_demo" defaultChecked={role?.demande_bande_demo} className="accent-coral" />
        Demander un lien de bande démo
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="visible_partage"
          defaultChecked={role?.visible_partage ?? true}
          className="accent-coral"
        />
        Visible sur le lien de partage réal
      </label>

      <Field label="PDF à joindre aux mails envoyés aux profils du rôle (optionnel)">
        <div className="flex flex-col gap-1.5">
          {role?.pdf_filename && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_pdf" className="accent-coral" />
              Retirer « {role.pdf_filename} »
            </label>
          )}
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            className="w-full rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-ink-raised-2 file:px-3 file:py-1 file:text-xs file:font-medium"
          />
        </div>
      </Field>

      <Field label="Corps du mail d'invitation (optionnel)">
        <textarea
          name="message_corps"
          defaultValue={role?.message_corps ?? ""}
          rows={5}
          placeholder={
            "Vide = message généré automatiquement. Sinon, utilise {prenom}, {role}, {projet}, {date} et " +
            "{lien} (obligatoire, c'est le lien d'envoi) — ex. « Bonjour {prenom}, le rôle {role} vous intéresse ? " +
            "Envoyez-nous ça via {lien} »"
          }
          className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : role ? "Enregistrer" : "Créer le rôle"}
      </Button>
    </form>
  );
}
