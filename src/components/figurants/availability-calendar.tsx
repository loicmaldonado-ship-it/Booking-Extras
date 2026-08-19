"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { addIndisponibilite, removeIndisponibilite } from "@/lib/figurants/disponibilites";

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

export function AvailabilityCalendar({
  token,
  initialDates,
  readOnly = false,
}: {
  token: string;
  initialDates: string[];
  readOnly?: boolean;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [month, setMonth] = useState(() => startOfMonth(today));
  const [unavailable, setUnavailable] = useState(new Set(initialDates));
  const [, startTransition] = useTransition();

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const list: (Date | null)[] = Array(startWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return list;
  }, [month]);

  function toggle(date: Date) {
    if (readOnly) return;
    const iso = toISODate(date);
    const isUnavailable = unavailable.has(iso);

    setUnavailable((prev) => {
      const next = new Set(prev);
      if (isUnavailable) next.delete(iso);
      else next.add(iso);
      return next;
    });

    startTransition(async () => {
      if (isUnavailable) await removeIndisponibilite(token, iso);
      else await addIndisponibilite(token, iso);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-ink-raised-2 hover:text-text"
        >
          ← Précédent
        </button>
        <span className="font-medium">
          {MOIS[month.getMonth()]} {month.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-ink-raised-2 hover:text-text"
        >
          Suivant →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted">
        {JOURS.map((j) => (
          <div key={j} className="py-1">
            {j}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const iso = toISODate(date);
          const isPast = date < today;
          const isUnavailable = unavailable.has(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast || readOnly}
              onClick={() => toggle(date)}
              className={cn(
                "aspect-square rounded-lg text-sm transition-colors",
                isPast
                  ? "text-text-muted/30"
                  : isUnavailable
                    ? "bg-coral text-ink font-medium"
                    : "bg-ink-raised-2 text-text hover:bg-ink-raised-2/70",
                readOnly && !isPast && "cursor-default"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-coral" /> Indisponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-ink-raised-2" /> Disponible
        </span>
      </div>
    </div>
  );
}
