"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CastingRoleForm } from "@/components/casting/casting-role-form";

export function NewCastingRoleCard({ projetId }: { projetId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Créer un rôle
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Créer un rôle de casting</h2>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
      <p className="text-sm text-text-muted">Décris le profil recherché. Tu pourras ensuite ajouter des candidat·es, des photos et des vidéos.</p>
      <CastingRoleForm projetId={projetId} onDone={() => setOpen(false)} />
    </Card>
  );
}
