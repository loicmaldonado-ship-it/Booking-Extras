"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateEssayageLieuProjet } from "@/lib/essayages/actions";

export function EssayageLieuProjetPanel({
  projetId,
  lieu,
  adresse,
}: {
  projetId: string;
  lieu: string | null;
  adresse: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lieuDraft, setLieuDraft] = useState(lieu ?? "");
  const [adresseDraft, setAdresseDraft] = useState(adresse ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateEssayageLieuProjet(projetId, lieuDraft.trim() || null, adresseDraft.trim() || null);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lieu d&apos;essayage</h2>
          <p className="mt-1 text-sm text-text-muted">
            Calibré une fois pour tout le projet — repris automatiquement sur toutes les journées d&apos;essayage
            et dans les messages envoyés (&laquo; RDV à 14h à {lieu || "Eurocostume"} &raquo;).
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : lieu ? "Modifier" : "Calibrer"}
        </Button>
      </div>
      {!open && (lieu || adresse) && (
        <p className="text-sm">
          {lieu}
          {lieu && adresse && " — "}
          {adresse}
        </p>
      )}
      {!open && !lieu && !adresse && <p className="text-sm text-text-muted">Aucun lieu calibré pour l&apos;instant.</p>}
      {open && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du lieu">
              <Input
                value={lieuDraft}
                onChange={(e) => setLieuDraft(e.target.value)}
                placeholder="Ex. Eurocostume"
                disabled={pending}
              />
            </Field>
            <Field label="Adresse">
              <Input
                value={adresseDraft}
                onChange={(e) => setAdresseDraft(e.target.value)}
                placeholder="Ex. 12 rue de la Paix, 75002 Paris"
                disabled={pending}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
