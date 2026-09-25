"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/format-date";
import { setCandidatureJour } from "@/lib/candidatures/jours";

export type JourCandidature = {
  id: string;
  date: string;
  disponible: boolean;
  prevu: boolean;
  dansLaJournee: boolean;
};

// Touches du tri rapide, une par date (rangée du haut d'un clavier AZERTY).
export const JOUR_KEYS = ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"];

// Une pastille par date de l'annonce. Pleine = prévue ; contour vert = dispo
// mais pas prévue ; pointillés barrés = s'est dite pas dispo (reste
// cliquable) ; ✓ = déjà dans la journée de tournage (ne se modifie plus
// ici, ça se gère dans Bookings).
export function JourChipsView({
  jours,
  onToggle,
  size = "sm",
  showKeys = false,
  center = false,
}: {
  jours: JourCandidature[];
  onToggle: (jour: JourCandidature) => void;
  size?: "sm" | "lg";
  showKeys?: boolean;
  center?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", size === "lg" && "gap-2", center && "justify-center")}>
      {jours.map((j, i) => (
        <button
          key={j.id}
          type="button"
          onClick={() => onToggle(j)}
          aria-pressed={j.prevu}
          title={
            j.dansLaJournee
              ? "Déjà dans la journée de tournage"
              : j.prevu
                ? "Prévu·e ce jour — cliquer pour retirer"
                : j.disponible
                  ? "Dispo — cliquer pour prévoir ce jour"
                  : "S'est dit·e pas dispo — cliquer pour prévoir quand même"
          }
          className={cn(
            "flex items-center gap-1 rounded-md border font-medium tabular-nums transition-colors",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1.5 text-sm",
            j.dansLaJournee
              ? "cursor-default border-turquoise bg-turquoise text-ink"
              : j.prevu
                ? "border-coral bg-coral text-ink hover:bg-coral-hover"
                : j.disponible
                  ? "border-turquoise/60 text-turquoise hover:bg-turquoise/10"
                  : "border-dashed border-border text-text-muted line-through hover:text-text"
          )}
        >
          {showKeys && JOUR_KEYS[i] && !j.dansLaJournee && (
            <kbd className="rounded border border-current/40 px-1 text-[10px] font-medium uppercase opacity-70">
              {JOUR_KEYS[i]}
            </kbd>
          )}
          {formatDayMonth(j.date)}
          {j.dansLaJournee && <Check size={size === "sm" ? 10 : 14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

// Version autonome pour les cartes et la vue liste : un clic prévoit ou
// retire la personne ce jour-là, affichage immédiat puis enregistrement.
export function JourChips({
  candidatureId,
  jours,
  center = false,
}: {
  candidatureId: string;
  jours: JourCandidature[];
  center?: boolean;
}) {
  const [local, setLocal] = useState(jours);
  const [synced, setSynced] = useState(jours);
  const [error, setError] = useState<string | null>(null);
  if (synced !== jours) {
    setSynced(jours);
    setLocal(jours);
  }
  if (local.length === 0) return null;

  function toggle(j: JourCandidature) {
    if (j.dansLaJournee) return;
    const before = local;
    setLocal(local.map((x) => (x.id === j.id ? { ...x, prevu: !x.prevu } : x)));
    setError(null);
    setCandidatureJour(candidatureId, j.id, !j.prevu).then((res) => {
      if (res.error) {
        setLocal(before);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <JourChipsView jours={local} onToggle={toggle} center={center} />
      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  );
}
