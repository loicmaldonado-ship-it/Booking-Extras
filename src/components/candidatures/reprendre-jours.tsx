"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JoursPanneau, type JourPanneau } from "./jours-panneau";
import { Modale } from "@/components/ui/modale";
import type { SelectionJours } from "@/lib/candidatures/jours-panel-snapshot";

export function ReprendreJours({ personne, jours, projetId }: { personne: SelectionJours; jours: JourPanneau[]; projetId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <span>
      <button type="button" className="font-medium text-coral underline" onClick={() => setOpen(true)}>
        {personne.nom} → gérer les autres journées
      </button>
      {open && (
        <Modale titre="📋 Gérer les journées" sousTitre={personne.nom} onClose={() => setOpen(false)} large>
          <JoursPanneau jours={jours} projetId={projetId} selection={[personne]} onEnvoye={() => router.refresh()} />
        </Modale>
      )}
    </span>
  );
}
