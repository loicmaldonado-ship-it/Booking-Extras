"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" className="print-hide" onClick={() => window.print()}>
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
