"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testerBoiteEnvoiProjet, testerMaBoiteEnvoi, type ResultatTestBoite } from "@/lib/projets/tester-boite-actions";

// Teste la boîte Gmail enregistrée (celle du projet, ou la sienne si
// projetId est absent) sans rien envoyer.
export function TesterBoiteButton({ projetId }: { projetId?: string }) {
  const [resultat, setResultat] = useState<ResultatTestBoite | null>(null);
  const [pending, demarrer] = useTransition();

  function tester() {
    setResultat(null);
    demarrer(async () => {
      setResultat(projetId ? await testerBoiteEnvoiProjet(projetId) : await testerMaBoiteEnvoi());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={tester} disabled={pending} className="self-start">
        {pending ? "Test en cours…" : "Tester la boîte d'envoi"}
      </Button>
      {resultat && (
        <p className={resultat.ok ? "text-sm text-turquoise" : "text-sm text-danger"}>
          {resultat.ok ? "✅ " : "⚠ "}
          {resultat.message}
        </p>
      )}
    </div>
  );
}
