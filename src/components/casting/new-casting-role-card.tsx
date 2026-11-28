"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CastingRoleForm } from "@/components/casting/casting-role-form";
import { ImportRolesCsv } from "@/components/casting/import-roles-csv";
import { CATEGORIE_CACHET_LABELS, type CategorieCachet } from "@/lib/casting/types";

export function NewCastingRoleCard({
  projetId,
  categorie = "role",
  ongletId,
  nomOnglet,
}: {
  projetId: string;
  categorie?: CategorieCachet;
  ongletId?: string | null;
  nomOnglet?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-wrap items-start gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          + Créer un rôle
        </Button>
        <ImportRolesCsv projetId={projetId} ongletId={ongletId ?? null} nomOnglet={nomOnglet ?? null} />
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nouveau casting · {CATEGORIE_CACHET_LABELS[categorie]}{nomOnglet ? ` · dans « ${nomOnglet} »` : ""}</h2>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
      <CastingRoleForm projetId={projetId} categorieParDefaut={categorie} ongletId={ongletId} onDone={() => setOpen(false)} />
    </Card>
  );
}
