"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBookingFromDrop } from "@/lib/bookings/actions";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { MultiDateCalendar } from "@/components/ui/multi-date-calendar";

export function AddToJourneeBar({
  figurantIds,
  projets,
  candidatureIdByFigurant,
  onDone,
}: {
  figurantIds: string[];
  projets: { id: string; nom: string }[];
  candidatureIdByFigurant?: Record<string, string>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "");
  const [dates, setDates] = useState<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; deja: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [calendarOpen]);

  function toggleDate(iso: string) {
    setDates((prev) => (prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso].sort()));
  }

  function removeDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
  }

  function submit() {
    if (!projetId || dates.length === 0 || figurantIds.length === 0) return;
    setResult(null);
    startTransition(async () => {
      let ok = 0;
      let deja = 0;
      for (const d of dates) {
        for (const figurantId of figurantIds) {
          const res = await createBookingFromDrop(
            figurantId,
            projetId,
            d,
            candidatureIdByFigurant?.[figurantId],
            fonction,
            cachet
          );
          if (res?.error) deja += 1;
          else ok += 1;
        }
      }
      setResult({ ok, deja });
      setDates([]);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3">
      <span className="text-sm font-medium">
        {figurantIds.length} sélectionné{figurantIds.length > 1 ? "s" : ""}
      </span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Projet</label>
        <select
          value={projetId}
          onChange={(e) => setProjetId(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="" disabled>
            Choisir un projet
          </option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="relative flex flex-col gap-1" ref={popoverRef}>
        <label className="text-xs text-text-muted">
          Date{dates.length > 0 ? `s (${dates.length})` : ""}
        </label>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setCalendarOpen((v) => !v)}
        >
          {dates.length > 0
            ? `${dates.length} date${dates.length > 1 ? "s" : ""} choisie${dates.length > 1 ? "s" : ""}`
            : "📅 Choisir les dates"}
        </Button>
        {calendarOpen && (
          <div className="absolute left-0 top-full z-20 mt-1">
            <MultiDateCalendar selected={new Set(dates)} onToggle={toggleDate} />
          </div>
        )}
        {dates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {dates.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 rounded-full border border-border bg-ink px-2 py-0.5 text-xs"
              >
                {d}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeDate(d)}
                  className="text-text-muted hover:text-danger"
                  title="Retirer cette date"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Fonction (optionnel)</label>
        <input
          type="text"
          value={fonction}
          onChange={(e) => setFonction(e.target.value)}
          placeholder="Passant, Silhouette videur..."
          disabled={pending}
          className="w-48 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Cachet (optionnel)</label>
        <select
          value={cachet}
          onChange={(e) => setCachet(e.target.value as Cachet | "")}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="">—</option>
          {CACHETS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" disabled={pending || !projetId || dates.length === 0} onClick={submit}>
        {pending
          ? "Ajout..."
          : dates.length > 1
            ? `Ajouter aux ${dates.length} dates`
            : "Ajouter à la journée"}
      </Button>
      {result && (
        <span className="text-xs text-text-muted">
          {result.ok} ajouté{result.ok > 1 ? "s" : ""}
          {result.deja > 0 ? ` · ${result.deja} déjà booké${result.deja > 1 ? "s" : ""}` : ""}
        </span>
      )}
    </div>
  );
}
