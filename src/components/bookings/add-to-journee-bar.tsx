"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBookingFromDrop } from "@/lib/bookings/actions";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";

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
  const [date, setDate] = useState("");
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; deja: number } | null>(null);

  function submit() {
    if (!projetId || !date || figurantIds.length === 0) return;
    setResult(null);
    startTransition(async () => {
      let ok = 0;
      let deja = 0;
      for (const figurantId of figurantIds) {
        const res = await createBookingFromDrop(
          figurantId,
          projetId,
          date,
          candidatureIdByFigurant?.[figurantId],
          fonction,
          cachet
        );
        if (res?.error) deja += 1;
        else ok += 1;
      }
      setResult({ ok, deja });
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
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
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
      <Button type="button" disabled={pending || !projetId || !date} onClick={submit}>
        {pending ? "Ajout..." : "Ajouter à la journée"}
      </Button>
      {result && (
        <span className="text-xs text-text-muted">
          {result.ok} ajouté{result.ok > 1 ? "s" : ""}
          {result.deja > 0 ? ` · ${result.deja} déjà booké${result.deja > 1 ? "s" : ""} ce jour` : ""}
        </span>
      )}
    </div>
  );
}
