"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleAnnonceStatut } from "@/lib/annonces/actions";
import type { AnnonceStatut } from "@/lib/annonces/types";

export function ToggleStatutButton({ id, statut }: { id: string; statut: AnnonceStatut }) {
  const [pending, startTransition] = useTransition();
  const next: AnnonceStatut = statut === "ouverte" ? "fermée" : "ouverte";

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => toggleAnnonceStatut(id, next))}
    >
      {pending ? "..." : statut === "ouverte" ? "Fermer l'annonce" : "Rouvrir l'annonce"}
    </Button>
  );
}
