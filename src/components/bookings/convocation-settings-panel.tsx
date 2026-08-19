"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { updateConvocationSettings } from "@/lib/bookings/actions";
import {
  DEFAULT_CONVOCATION_PRECISIONS,
  DEFAULT_CONVOCATION_HMC,
  DEFAULT_CONVOCATION_COMMENTAIRES,
} from "@/lib/bookings/convocation";

const FIELDS = [
  { name: "convocation_precisions", label: "Précisions", placeholder: DEFAULT_CONVOCATION_PRECISIONS },
  { name: "convocation_hmc", label: "HMC (habillage, maquillage, coiffure)", placeholder: DEFAULT_CONVOCATION_HMC },
  { name: "convocation_accessoires", label: "Accessoires", placeholder: "Accessoires à prévoir (optionnel)" },
  { name: "convocation_commentaires", label: "Commentaires", placeholder: DEFAULT_CONVOCATION_COMMENTAIRES },
] as const;

export function ConvocationSettingsPanel({
  journeeId,
  lieu,
  projetLieu,
  precisions,
  hmc,
  accessoires,
  commentaires,
}: {
  journeeId: string;
  lieu: string | null;
  projetLieu: string | null;
  precisions: string | null;
  hmc: string | null;
  accessoires: string | null;
  commentaires: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateConvocationSettings.bind(null, journeeId), undefined);

  const values: Record<string, string | null> = {
    convocation_precisions: precisions,
    convocation_hmc: hmc,
    convocation_accessoires: accessoires,
    convocation_commentaires: commentaires,
  };

  const customized = (lieu && lieu.trim()) || Object.values(values).some((v) => v && v.trim());

  return (
    <Card className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-text-muted">
          Calibrer le message de convocation
          {customized && <span className="ml-2 text-xs font-normal text-coral">Personnalisé</span>}
        </span>
        <span className="text-text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <form action={formAction} className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Laisse un champ vide pour garder le texte par défaut (affiché en filigrane). Ces réglages s&apos;appliquent
            à toutes les convocations envoyées pour cette journée.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">
              Lieu de rendez-vous (remplace le lieu du projet pour cette journée)
            </label>
            <Input
              name="lieu"
              defaultValue={lieu ?? ""}
              placeholder={projetLieu ? `Lieu du projet : ${projetLieu}` : "Adresse de la salle figu / du rendez-vous"}
              disabled={pending}
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">{f.label}</label>
              <textarea
                name={f.name}
                defaultValue={values[f.name] ?? ""}
                placeholder={f.placeholder}
                disabled={pending}
                rows={f.name === "convocation_accessoires" ? 2 : 3}
                className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
              />
            </div>
          ))}
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
          {state?.success && <p className="text-xs text-turquoise">Enregistré.</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
