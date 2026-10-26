"use client";

import { FonctionsDatalist } from "@/components/projets/fonctions-datalist";
import { useState, useTransition, useRef, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBookingsFromDropBulk } from "@/lib/bookings/actions";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { MultiDateCalendar } from "@/components/ui/multi-date-calendar";

export function AddToJourneeBar({
  figurantIds,
  projets,
  candidatureIdByFigurant,
  candidatureProjectByFigurant,
  onDone,
  fonctionFacultative = false,
}: {
  figurantIds: string[];
  projets: { id: string; nom: string }[];
  candidatureIdByFigurant?: Record<string, string>;
  candidatureProjectByFigurant?: Record<string, string>;
  onDone?: () => void;
  // Depuis Candidatures : la fonction peut être choisie plus tard.
  fonctionFacultative?: boolean;
}) {
  const router = useRouter();
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "");
  const [dates, setDates] = useState<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; deja: number; error?: string } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

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
    if (pending || !projetId || dates.length === 0 || figurantIds.length === 0 || !cachet || (!fonctionFacultative && !fonction.trim())) return;
    setResult(null);
    startTransition(async () => {
      try {
        // Staff may book a known profile on another project. In that case
        // don't attach a candidature belonging to the previous project.
        const referenceIds = candidatureIdByFigurant && candidatureProjectByFigurant
          ? Object.fromEntries(Object.entries(candidatureIdByFigurant)
              .filter(([id]) => candidatureProjectByFigurant[id] === projetId))
          : candidatureIdByFigurant;
        const res = await createBookingsFromDropBulk(
          figurantIds,
          projetId,
          dates,
          referenceIds,
          fonction,
          cachet
        );
        setResult({ ok: res.ok, deja: res.deja, error: res.error });
        if (res.ok > 0) router.refresh();
        // Never discard the user's dates or close this panel on partial/failed inserts.
        if (!res.error) {
          setDates([]);
          onDone?.();
        }
      } catch {
        setResult({ ok: 0, deja: 0, error: "Impossible d'ajouter les bookings. Vérifie la connexion puis réessaie." });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-projet`} className="text-xs text-text-muted">Projet</label>
        <select
          id={`${fieldId}-projet`}
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
                  className="text-text hover:text-danger"
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
<label htmlFor={`${fieldId}-fonction`} className="text-xs text-text-muted">Fonction {fonctionFacultative ? "(facultatif)" : <span className="text-danger">*</span>}</label>
          <FonctionsDatalist id="fonctions-ajout-journee" projetId={projetId} />
        <input
          id={`${fieldId}-fonction`}
          type="text"
          list="fonctions-ajout-journee"
          value={fonction}
          onChange={(e) => setFonction(e.target.value)}
          placeholder="Passant, Silhouette videur..."
          disabled={pending}
          className="w-48 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
      </div>
      <div className="flex flex-col gap-1">
<label htmlFor={`${fieldId}-cachet`} className="text-xs text-text-muted">Cachet <span className="text-danger">*</span></label>
        <select
          id={`${fieldId}-cachet`}
          value={cachet}
          onChange={(e) => setCachet(e.target.value as Cachet | "")}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {CACHETS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        disabled={pending || !projetId || dates.length === 0 || !cachet || (!fonctionFacultative && !fonction.trim())}
        onClick={submit}
        title={!cachet || (!fonctionFacultative && !fonction.trim()) ? "Choisis la fonction et le cachet" : undefined}
      >
        {pending
          ? "Envoi..."
          : dates.length > 1
            ? `Envoyer dans les ${dates.length} journées de booking`
            : "Envoyer dans la journée de booking"}
      </Button>
{(!cachet || (!fonctionFacultative && !fonction.trim())) && (
          <span className="text-xs text-text-muted">{fonctionFacultative ? "Cachet obligatoire." : "Fonction et cachet obligatoires."}</span>
        )}
      {result && (
        <span role={result.error ? "alert" : "status"}
          className={`text-xs ${result.error ? "text-danger" : "text-text-muted"}`}>
          {result.error ? `${result.error} ` : ""}
          {result.ok > 0 ? `${result.ok} ajouté${result.ok > 1 ? "s" : ""}` : ""}
          {result.deja > 0 ? ` · ${result.deja} déjà booké${result.deja > 1 ? "s" : ""}` : ""}
        </span>
      )}
    </div>
  );
}
