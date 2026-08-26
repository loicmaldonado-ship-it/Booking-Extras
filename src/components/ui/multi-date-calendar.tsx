"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Calendrier visuel à sélection multiple — pensé pour attribuer des dates à
// une sélection de profils en quelques clics plutôt qu'un champ date natif
// repris un jour à la fois (voir AddToJourneeBar). Généralisé à partir
// d'AvailabilityCalendar (figurants/availability-calendar.tsx), qui reste
// spécifique aux indisponibilités déclarées par le figurant lui-même.
export function MultiDateCalendar({
  selected,
  onToggle,
  disablePast = true,
}: {
  selected: Set<string>;
  onToggle: (iso: string) => void;
  disablePast?: boolean;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [month, setMonth] = useState(() => startOfMonth(today));

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const startWeekday = (first.getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const list: (Date | null)[] = Array(startWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return list;
  }, [month]);

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-xl border border-border bg-ink p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="rounded-full px-2 py-1 text-xs text-text-muted hover:bg-ink-raised-2 hover:text-text"
        >
          ← Préc.
        </button>
        <span className="text-sm font-medium">
          {MOIS[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="rounded-full px-2 py-1 text-xs text-text-muted hover:bg-ink-raised-2 hover:text-text"
        >
          Suiv. →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted">
        {JOURS.map((j) => (
          <div key={j} className="py-0.5">
            {j}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const iso = toISODate(date);
          const isPast = disablePast && date < today;
          const isSelected = selected.has(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onToggle(iso)}
              title={iso}
              className={cn(
                "aspect-square rounded-lg text-sm font-medium transition-colors",
                isPast
                  ? "text-text-muted/30"
                  : isSelected
                    ? "bg-coral text-ink"
                    : "bg-ink-raised-2 text-text hover:bg-ink-raised-2/70"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
