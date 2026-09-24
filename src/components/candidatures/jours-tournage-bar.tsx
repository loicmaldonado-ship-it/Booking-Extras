"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateLong, formatDayMonth } from "@/lib/format-date";
import { envoyerJourAuTournage } from "@/lib/candidatures/jours";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type JourTournage = {
  id: string;
  date: string;
  prevues: number;
  dansLaJournee: number;
  besoin: number | null;
};

// Une pastille par date de l'annonce = un "onglet jour" : combien de
// personnes y sont prévues (et le besoin saisi dans Bookings). Le jour
// sélectionné filtre la liste et propose d'envoyer tout le monde dans la
// journée de tournage, après confirmation.
export function JoursTournageBar({
  jours,
  activeId,
  hrefs,
  clearHref,
  projetId,
}: {
  jours: JourTournage[];
  activeId: string | null;
  hrefs: Record<string, string>;
  clearHref: string;
  projetId: string;
}) {
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: number; deja: number; error?: string; jourId: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const active = jours.find((j) => j.id === activeId) ?? null;
  const aEnvoyer = active ? active.prevues - active.dansLaJournee : 0;

  function envoyer() {
    if (!active) return;
    startTransition(async () => {
      const res = await envoyerJourAuTournage(active.id, fonction, cachet);
      setResult({ ...res, jourId: active.id });
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-ink-raised px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Jours de tournage :</span>
        {jours.map((j) => {
          const isActive = j.id === activeId;
          const complet = j.besoin !== null && j.prevues >= j.besoin;
          return (
            <Link
              key={j.id}
              href={isActive ? clearHref : hrefs[j.id]}
              onClick={() => {
                setConfirming(false);
                setResult(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors",
                isActive ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
              )}
            >
              Jour {formatDayMonth(j.date)} ·{" "}
              <span className={cn(complet && "text-turquoise")}>
                {j.prevues}
                {j.besoin !== null ? ` / ${j.besoin}` : ""}
              </span>{" "}
              prévu·e{j.prevues > 1 ? "s" : ""}
            </Link>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">
        Clique sur les dates d&apos;une carte (ou tape A, Z, E… dans le tri rapide) pour prévoir une personne sur un ou
        plusieurs jours. Le chiffre après la barre est le besoin saisi dans Bookings pour cette journée.
      </p>

      {active && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-sm">
            <strong>{formatDateLong(active.date)}</strong> : {active.prevues} personne{active.prevues > 1 ? "s" : ""} prévue
            {active.prevues > 1 ? "s" : ""}
            {active.dansLaJournee > 0 && `, dont ${active.dansLaJournee} déjà dans la journée`}.
          </p>
          {result?.jourId === active.id &&
            (result.error ? (
              <p className="text-sm text-danger">{result.error}</p>
            ) : (
              <p className="text-sm text-turquoise">
                {result.ok} personne{result.ok > 1 ? "s" : ""} ajoutée{result.ok > 1 ? "s" : ""} à la journée
                {result.deja > 0 && ` (${result.deja} y étai${result.deja > 1 ? "ent" : "t"} déjà)`}.{" "}
                <Link
                  href={`/bookings/documents?projet_id=${projetId}&date=${active.date}`}
                  className="font-medium underline"
                >
                  Voir la journée →
                </Link>
              </p>
            ))}
          {aEnvoyer > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Fonction (optionnel)</label>
                <Input value={fonction} onChange={(e) => setFonction(e.target.value)} placeholder="Ex. clients du bar" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-muted">Cachet (optionnel)</label>
                <Select value={cachet} onChange={(e) => setCachet(e.target.value as Cachet | "")}>
                  <option value="">—</option>
                  {CACHETS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text-muted">
                    Crée {aEnvoyer} booking{aEnvoyer > 1 ? "s" : ""} en « PER », comme un ajout à une journée. Rien
                    n&apos;est envoyé aux figurant·es.
                  </span>
                  <Button type="button" disabled={pending} onClick={envoyer}>
                    {pending ? "Envoi…" : "Confirmer"}
                  </Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button type="button" onClick={() => setConfirming(true)}>
                  Envoyer {aEnvoyer} personne{aEnvoyer > 1 ? "s" : ""} dans la journée du {formatDayMonth(active.date)}
                </Button>
              )}
            </div>
          )}
          {aEnvoyer === 0 && active.prevues > 0 && !result && (
            <p className="text-xs text-text-muted">Tout le monde prévu ce jour est déjà dans la journée.</p>
          )}
          {active.prevues === 0 && (
            <p className="text-xs text-text-muted">Personne n&apos;est encore prévu ce jour-là.</p>
          )}
        </div>
      )}
    </div>
  );
}
