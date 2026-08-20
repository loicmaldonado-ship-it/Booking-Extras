"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  setCandidatureOnglet,
  createCandidatureOnglet,
} from "@/lib/candidatures/actions";
import type { CandidatureOnglet } from "@/lib/candidatures/types";

export const TONE_CLASSES: Record<CandidatureOnglet["couleur"], string> = {
  default: "border-border text-text-muted hover:text-text",
  coral: "border-coral bg-coral/15 text-coral",
  turquoise: "border-turquoise bg-turquoise/15 text-turquoise",
  yellow: "border-yellow bg-yellow/15 text-yellow",
  danger: "border-danger bg-danger/15 text-danger",
};

export function OngletPicker({
  candidatureId,
  ongletId,
  onglets,
}: {
  candidatureId: string;
  ongletId: string | null;
  onglets: CandidatureOnglet[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function assign(id: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setCandidatureOnglet(candidatureId, id);
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  function creer() {
    if (!nouveauNom.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCandidatureOnglet(nouveauNom.trim());
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.onglet) {
        await setCandidatureOnglet(candidatureId, result.onglet.id);
      }
      setCreating(false);
      setNouveauNom("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => assign(null)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            ongletId === null ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          À trier
        </button>
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={pending}
            onClick={() => assign(o.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              ongletId === o.id ? TONE_CLASSES[o.couleur] : "border-border text-text-muted hover:text-text"
            )}
          >
            {o.nom}
          </button>
        ))}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            + Nouveau
          </button>
        )}
      </div>
      {creating && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                creer();
              }
            }}
            placeholder="Ex. Ok dispo le 26/06"
            className="w-44 rounded-lg border border-border bg-ink px-2 py-1 text-xs outline-none focus:border-coral"
          />
          <button type="button" onClick={creer} disabled={pending || !nouveauNom.trim()} className="text-xs text-coral hover:underline">
            Créer
          </button>
          <button type="button" onClick={() => { setCreating(false); setNouveauNom(""); }} className="text-xs text-text-muted hover:text-text">
            Annuler
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
