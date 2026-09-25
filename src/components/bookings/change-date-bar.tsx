"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { moveBookingsToDate } from "@/lib/bookings/actions";

// Déplace les bookings sélectionnés vers une autre journée du projet, ou
// vers une nouvelle date (la journée est alors créée). Toujours avec une
// étape de confirmation : ça remet la convocation à zéro.
export function ChangeDateBar({
  bookingIds,
  currentDate,
  autresJournees,
  onDone,
  onPartial,
}: {
  bookingIds: string[];
  currentDate?: string;
  autresJournees: string[];
  onDone: (message: string) => void;
  // Déplacement partiel : ne garder sélectionnés que ceux restés ici.
  onPartial: (restantIds: string[]) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [repasserEnPer, setRepasserEnPer] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ moved: number; conflits: string[]; error?: string; date: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const n = bookingIds.length;
  const valide = !!date && date !== currentDate;

  function deplacer() {
    const target = date;
    startTransition(async () => {
      const res = await moveBookingsToDate(bookingIds, target, repasserEnPer);
      setResult({ ...res, date: target });
      setConfirming(false);
      if (res.moved > 0) {
        router.refresh();
        if (res.conflits.length === 0) {
          onDone(`${res.moved} personne${res.moved > 1 ? "s" : ""} déplacée${res.moved > 1 ? "s" : ""} au ${formatDateShort(target)}.`);
        } else {
          onPartial(res.restantIds);
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          Déplacer {n} personne{n > 1 ? "s" : ""} vers :
        </span>
        {autresJournees.map((d) => (
          <button
            key={d}
            type="button"
            disabled={pending}
            onClick={() => {
              setDate(d);
              setConfirming(false);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors",
              date === d ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
            )}
          >
            {formatDateShort(d)}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          {autresJournees.length > 0 ? "ou autre date" : "Date"}
          <input
            type="date"
            value={autresJournees.includes(date) ? "" : date}
            onChange={(e) => {
              setDate(e.target.value);
              setConfirming(false);
            }}
            disabled={pending}
            className="rounded-full border border-border bg-ink px-3 py-1 text-sm outline-none focus:border-coral disabled:opacity-60"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={repasserEnPer}
          onChange={(e) => setRepasserEnPer(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-coral"
        />
        Repasser en « PER » : la personne doit reconfirmer pour la nouvelle date
      </label>

      {valide &&
        (confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">
              {formatDateLong(date)} : la convocation et le « bien reçu » repartent à zéro, et les liens de
              covoiturage avec l&apos;ancienne date sont retirés. Rien n&apos;est envoyé aux figurant·es.
            </span>
            <Button type="button" disabled={pending} onClick={deplacer}>
              {pending ? "Déplacement…" : "Confirmer"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <div>
            <Button type="button" onClick={() => setConfirming(true)}>
              Déplacer au {formatDateShort(date)}
            </Button>
          </div>
        ))}

      {result &&
        (result.error ? (
          <p className="text-sm text-danger">{result.error}</p>
        ) : (
          <p className="text-sm">
            {result.moved > 0 && (
              <span className="text-turquoise">
                {result.moved} personne{result.moved > 1 ? "s" : ""} déplacée{result.moved > 1 ? "s" : ""} au{" "}
                {formatDateShort(result.date)}.{" "}
              </span>
            )}
            {result.conflits.length > 0 && (
              <span className="text-yellow">
                Pas déplacé{result.conflits.length > 1 ? "s" : ""} car déjà booké·e{result.conflits.length > 1 ? "s" : ""} ce
                jour-là : {result.conflits.join(", ")}.
              </span>
            )}
          </p>
        ))}
    </div>
  );
}
