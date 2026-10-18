"use client";

import { useEffect, useState } from "react";
import { listerFonctionsProjet } from "@/lib/projets/fonctions";

// Liste déroulante des fonctions enregistrées d'un projet, à relier à un
// champ texte avec `list={id}` : on choisit une fonction connue ou on en
// tape une nouvelle (enregistrée d'office à la sauvegarde).
const cache = new Map<string, Promise<string[]>>();

export function FonctionsDatalist({ id, projetId }: { id: string; projetId: string | null | undefined }) {
  const [fonctions, setFonctions] = useState<{ projetId: string; liste: string[] } | null>(null);

  useEffect(() => {
    if (!projetId) return;
    let actif = true;
    if (!cache.has(projetId)) cache.set(projetId, listerFonctionsProjet(projetId));
    cache.get(projetId)!.then((liste) => {
      if (actif) setFonctions({ projetId, liste });
    });
    // Rechargée à la prochaine ouverture (nouvelles fonctions saisies).
    return () => {
      actif = false;
      cache.delete(projetId);
    };
  }, [projetId]);

  const liste = fonctions && fonctions.projetId === projetId ? fonctions.liste : [];
  return (
    <datalist id={id}>
      {liste.map((f) => (
        <option key={f} value={f} />
      ))}
    </datalist>
  );
}
