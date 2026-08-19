"use client";

import { useState } from "react";
import { AnchorButton, Button } from "@/components/ui/button";

export function ExportMyroleButtons({ projetId, date }: { projetId?: string; date?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  if (!projetId || !date) {
    return (
      <p className="text-xs text-text-muted">
        Choisis un projet et une date pour exporter la journée vers Myrole (seuls les bookings
        confirmés sont inclus).
      </p>
    );
  }

  const query = new URLSearchParams({ projet_id: projetId, date }).toString();

  return (
    <div className="flex items-center gap-3">
      <AnchorButton href={`/bookings/export-myrole?${query}`} variant="secondary">
        Exporter Myrole (CSV)
      </AnchorButton>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            const res = await fetch(`/bookings/export-myrole?${query}&format=emails`);
            const text = await res.text();
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("error");
          } finally {
            setTimeout(() => setState("idle"), 2000);
          }
        }}
      >
        {state === "copied" ? "Emails copiés !" : state === "error" ? "Erreur" : "Copier les emails"}
      </Button>
      <span className="text-xs text-text-muted">Seuls les bookings confirmés sont inclus.</span>
    </div>
  );
}
