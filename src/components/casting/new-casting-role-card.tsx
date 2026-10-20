"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CastingRoleForm } from "@/components/casting/casting-role-form";
import { CATEGORIE_CACHET_LABELS, type CategorieCachet } from "@/lib/casting/types";

export function NewCastingRoleCard({ projetId, categorie = "role" }: { projetId: string; categorie?: CategorieCachet }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Nouveau casting
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nouveau casting · {CATEGORIE_CACHET_LABELS[categorie]}</h2>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
      <CastingRoleForm projetId={projetId} categorieParDefaut={categorie} onDone={() => setOpen(false)} />
    </Card>
  );
}
