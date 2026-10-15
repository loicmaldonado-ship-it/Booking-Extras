"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format-date";

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Période de tournage : le·la candidat·e touche seulement les jours où il·elle
// n'est PAS disponible (tous les autres jours de la période comptent comme
// dispo). La liste part dans le champ caché `indispos` (ids des dates).
export function CalendrierIndispos({ dates }: { dates: { id: string; date: string }[] }) {
  const [indispos, setIndispos] = useState<Set<string>>(new Set());
  const idParDate = useMemo(() => new Map(dates.map((d) => [d.date.slice(0, 10), d.id])), [dates]);

  // Mois couverts par les dates, chacun en grille lundi → dimanche.
  const mois = useMemo(() => {
    const triees = Array.from(idParDate.keys()).sort();
    if (triees.length === 0) return [];
    const [an0, m0] = triees[0].split("-").map(Number);
    const [an1, m1] = triees[triees.length - 1].split("-").map(Number);
    const liste: { an: number; mois: number; cases: (string | null)[] }[] = [];
    let an = an0;
    let m = m0;
    while (an < an1 || (an === an1 && m <= m1)) {
      const premier = new Date(Date.UTC(an, m - 1, 1));
      const decalage = (premier.getUTCDay() + 6) % 7;
      const nbJours = new Date(Date.UTC(an, m, 0)).getUTCDate();
      const cases: (string | null)[] = Array(decalage).fill(null);
      for (let j = 1; j <= nbJours; j++) cases.push(`${an}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
      liste.push({ an, mois: m, cases });
      if (m === 12) {
        an += 1;
        m = 1;
      } else m += 1;
    }
    return liste;
  }, [idParDate]);

  function basculer(id: string) {
    setIndispos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const listeIndispos = dates.filter((d) => indispos.has(d.id)).map((d) => formatDateShort(d.date));

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="indispos" value={Array.from(indispos).join(",")} />
      <p className="text-sm text-text-muted">
        Touche les jours où tu <strong className="text-text">n&apos;es pas disponible</strong>. Si tu es dispo
        sur toute la période, ne touche à rien.
      </p>
      <div className="flex flex-wrap gap-6">
        {mois.map((m) => (
          <div key={`${m.an}-${m.mois}`} className="flex w-full max-w-xs flex-col gap-2">
            <span className="text-sm font-semibold">
              {MOIS[m.mois - 1]} {m.an}
            </span>
            <div className="grid grid-cols-7 gap-1 text-center">
              {JOURS.map((j) => (
                <span key={j} className="text-[10px] font-medium uppercase text-text-muted">
                  {j}
                </span>
              ))}
              {m.cases.map((iso, i) => {
                if (!iso) return <span key={`vide-${i}`} />;
                const id = idParDate.get(iso);
                const jour = Number(iso.slice(8, 10));
                if (!id) {
                  return (
                    <span key={iso} className="flex aspect-square w-full items-center justify-center text-sm text-text-muted/40">
                      {jour}
                    </span>
                  );
                }
                const indispo = indispos.has(id);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => basculer(id)}
                    aria-pressed={indispo}
                    aria-label={`${formatDateShort(iso)} : ${indispo ? "pas disponible" : "disponible"}`}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                      indispo
                        ? "border-danger bg-danger text-white line-through"
                        : "border-turquoise/60 bg-turquoise/10 text-text hover:border-danger"
                    )}
                  >
                    {jour}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-turquoise/60 bg-turquoise/10" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-danger" /> Pas disponible
        </span>
      </div>
      <p className="text-sm">
        {listeIndispos.length === 0
          ? "Disponible sur toute la période."
          : `Pas disponible : ${listeIndispos.join(", ")}.`}
      </p>
    </div>
  );
}
