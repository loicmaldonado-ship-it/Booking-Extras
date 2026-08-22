"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";

export function AddDatesPanel({
  figurantId,
  projets,
}: {
  figurantId: string;
  projets: { id: string; nom: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Ajouter des dates
      </Button>
    );
  }

  return (
    <div className="w-full">
      <AddToJourneeBar figurantIds={[figurantId]} projets={projets} onDone={() => setOpen(false)} />
    </div>
  );
}
