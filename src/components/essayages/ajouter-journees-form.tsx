"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { createEssayageJournee } from "@/lib/essayages/actions";

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

// Calendrier à sélection multiple — on clique les jours voulus (même sur
// plusieurs mois d'affilée) puis un seul "Créer" envoie toutes les dates
// d'un coup. Remplace la ressaisie manuelle date par date, source d'erreurs.
export function AjouterJourneesForm({
  projetId,
  existingDates,
}: {
  projetId: string;
  existingDates: string[];
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const existing = useMemo(() => new Set(existingDates), [existingDates]);

  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  function toggle(date: Date) {
    const iso = toISODate(date);
    if (existing.has(iso)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  const sortedSelected = Array.from(selected).sort();

  return (
    <form action={createEssayageJournee.bind(null, projetId)} className="flex flex-col gap-3">
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
          const isExisting = existing.has(iso);
          const isSelected = selected.has(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={isExisting}
              onClick={() => toggle(date)}
              title={isExisting ? "Journée déjà créée" : undefined}
              className={cn(
                "aspect-square rounded-lg text-sm transition-colors",
                isExisting
                  ? "cursor-default bg-ink-raised-2/40 text-text-muted/50"
                  : isSelected
                    ? "bg-coral text-ink font-medium"
                    : "bg-ink-raised-2 text-text hover:bg-ink-raised-2/70"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-coral" /> Sélectionné
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-ink-raised-2/40" /> Déjà créée
        </span>
      </div>

      {sortedSelected.map((iso) => (
        <input key={iso} type="hidden" name="date" value={iso} />
      ))}

      <button
        type="submit"
        disabled={sortedSelected.length === 0}
        className="self-start rounded-full bg-coral px-5 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Créer {sortedSelected.length > 0 ? `(${sortedSelected.length})` : ""}
      </button>
    </form>
  );
}
