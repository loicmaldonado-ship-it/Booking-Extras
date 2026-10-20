"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modale } from "@/components/ui/modale";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";

export function AddDatesPanel({
  figurantId,
  projets,
}: {
  figurantId: string;
  projets: { id: string; nom: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Ajouter des dates
      </Button>
      {open && (
        <Modale titre="📅 Ajouter des dates" onClose={() => setOpen(false)}>
          <AddToJourneeBar figurantIds={[figurantId]} projets={projets} />
        </Modale>
      )}
    </>
  );
}
