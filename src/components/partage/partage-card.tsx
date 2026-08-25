"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CopyLink } from "@/components/annonces/copy-link";
import { createPartageLien, revokePartageLien, updatePartageTitre, type PartageType } from "@/lib/partage/actions";

export function PartageCard({
  projetId,
  type,
  label,
  description,
  token,
  publicBaseUrl,
  titre,
  titrePlaceholder,
}: {
  projetId: string;
  type: PartageType;
  label: string;
  description: string;
  token: string | null;
  publicBaseUrl: string;
  // Fourni uniquement quand le titre affiché sur la page publique doit être
  // personnalisable (ex. Casting) — absent ailleurs (documents, essayages).
  titre?: string | null;
  titrePlaceholder?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [titreValue, setTitreValue] = useState(titre ?? "");
  const [titreSaved, setTitreSaved] = useState(false);

  function create() {
    startTransition(async () => {
      await createPartageLien(projetId, type);
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokePartageLien(projetId, type);
      router.refresh();
    });
  }

  function saveTitre() {
    setTitreSaved(false);
    startTransition(async () => {
      await updatePartageTitre(projetId, type, titreValue.trim() || null);
      setTitreSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="text-xs text-text-muted">{description}</p>
      </div>

      {token ? (
        <div className="flex flex-col gap-2">
          <CopyLink url={`${publicBaseUrl}/${token}`} />
          {titre !== undefined && (
            <div className="flex items-center gap-2">
              <Input
                value={titreValue}
                onChange={(e) => {
                  setTitreValue(e.target.value);
                  setTitreSaved(false);
                }}
                placeholder={titrePlaceholder ?? "Titre affiché"}
              />
              <Button type="button" variant="secondary" disabled={pending} onClick={saveTitre}>
                {titreSaved ? "Enregistré" : "Enregistrer le titre"}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={create}>
              Régénérer le lien
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={revoke}>
              Révoquer
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" disabled={pending} onClick={create}>
          {pending ? "Création..." : "Créer un lien de partage"}
        </Button>
      )}
    </div>
  );
}
