"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatDateLong } from "@/lib/format-date";
import { envoyerCandidaturesDansJour } from "@/lib/candidatures/jours";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { marquerJoursEnvoyes, type SelectionJours } from "@/lib/candidatures/jours-panel-snapshot";

export type JourPanneau = {
  id: string;
  date: string;
  // Somme des besoins saisis dans Bookings (null = rien de saisi).
  besoin: number | null;
  // Bookings de la journée hors annulé·es / indispos.
  dansLaJournee: number;
  fonctions: { fonction: string; besoin: number; places: number }[];
  // Profils rangés dans l'onglet de cette journée, encore dans Candidatures.
  rangees: number;
  // La journée dans Bookings.
  bookingHref: string;
};


const champ = "w-full rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral";

// Envoi en booking depuis Candidatures : un bloc par date de l'annonce, avec
// la jauge besoin / présent·es, et l'envoi des profils cochés dans ce jour
// (confirmation sur place).
export function JoursPanneau({
  jours,
  projetId,
  selection,
  onEnvoye,
}: {
  jours: JourPanneau[];
  projetId: string;
  selection: SelectionJours[];
  onEnvoye: () => void;
}) {
  const [selectionFigee, setSelectionFigee] = useState(selection);
  const [envoi, setEnvoi] = useState<{ jourId: string } | null>(null);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [aussiPasDispo, setAussiPasDispo] = useState(false);
  const [resultat, setResultat] = useState<{ jourId: string; ok: number; deja: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function demarrer(jourId: string) {
    setEnvoi({ jourId });
    setResultat(null);
    setAussiPasDispo(false);
  }

  function envoyer(jour: JourPanneau, ids: string[]) {
    startTransition(async () => {
      const res = await envoyerCandidaturesDansJour(jour.id, ids, fonction, cachet);
      setResultat({ jourId: jour.id, ...res });
      if (!res.error) {
        setSelectionFigee((avant) => marquerJoursEnvoyes(avant, jour.id, ids));
        setEnvoi(null);
        onEnvoye();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        <b>Envoyer en booking</b> crée le booking (en PER,
        rien n&apos;est envoyé aux figurant·es). Besoins saisis dans Bookings.
      </p>
      {jours.map((j) => {
        const pasEncore = selectionFigee.filter((s) => !s.jours.find((x) => x.id === j.id)?.dansLaJournee);
        const dispo = pasEncore.filter((s) => s.jours.find((x) => x.id === j.id)?.disponible);
        const pasDispo = pasEncore.filter((s) => !s.jours.find((x) => x.id === j.id)?.disponible);
        const aEnvoyer = aussiPasDispo ? pasEncore : dispo;
        const enCours = envoi?.jourId === j.id;
        const complet = j.besoin !== null && j.dansLaJournee >= j.besoin;
        const pc = j.besoin ? Math.min(100, (j.dansLaJournee / j.besoin) * 100) : 0;
        return (
          <div
            key={j.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-ink p-3",
              enCours ? "border-coral/70" : "border-border"
            )}
          >
            <div className="flex flex-col gap-1.5 text-left">
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                <span>
                  {formatDateLong(j.date)}
                </span>
                <span className="tabular-nums">
                  {j.dansLaJournee}
                  {j.besoin !== null && ` / ${j.besoin}`}
                </span>
              </span>
              {j.besoin !== null && (
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-ink-raised-2">
                  <span
                    className={cn("block h-full rounded-full", complet ? "bg-turquoise" : "bg-yellow")}
                    style={{ width: `${pc}%` }}
                  />
                </span>
              )}
              <span className="flex w-full flex-wrap justify-between gap-x-2 text-xs text-text-muted">
                <span className={cn(complet && "font-medium text-turquoise")}>
                  {j.besoin === null
                    ? `${j.dansLaJournee} en booking`
                    : complet
                      ? "✓ Complet"
                      : `Il manque ${j.besoin - j.dansLaJournee}`}
                </span>
                {selectionFigee.length > 0 && (
                  <span>
                    {dispo.length}/{selectionFigee.length} coché{selectionFigee.length > 1 ? "s" : ""} dispo
                  </span>
                )}
              </span>
            </div>

            <Link
              href={j.bookingHref}
              className="rounded-lg border border-border-strong px-2 py-1.5 text-center text-xs font-medium hover:border-text"
            >
              📋 Voir la journée dans Bookings ({j.dansLaJournee} en booking)
            </Link>

            {resultat?.jourId === j.id && (
              <p className={cn("text-xs", resultat.error ? "text-danger" : "font-medium text-turquoise")}>
                {resultat.error ??
                  `✓ ${resultat.ok} envoyé${resultat.ok > 1 ? "s" : ""} en booking${
                    resultat.deja > 0 ? ` (${resultat.deja} y étai${resultat.deja > 1 ? "ent" : "t"} déjà)` : ""
                  }.`}
              </p>
            )}

            {enCours ? (
              <div className="flex flex-col gap-2 rounded-lg border border-coral/50 bg-coral/5 p-2.5 text-xs">
                <p className="text-sm">
                  Envoyer <b>{aEnvoyer.length}</b> personne{aEnvoyer.length > 1 ? "s" : ""} en booking le{" "}
                  {formatDayMonth(j.date)} ?
                </p>
                {pasDispo.length > 0 && (
                  <label className="flex items-start gap-2 text-danger">
                    <input
                      type="checkbox"
                      checked={aussiPasDispo}
                      onChange={(e) => setAussiPasDispo(e.target.checked)}
                      className="mt-0.5 accent-coral"
                    />
                    <span>
                      {pasDispo.length} pas dispo ce jour-là ({pasDispo.map((s) => s.nom).join(", ")}) :{" "}
                      {aussiPasDispo ? "envoyé" : "pas envoyé"}
                      {pasDispo.length > 1 ? "s" : ""}. Cocher pour les envoyer quand même.
                    </span>
                  </label>
                )}
                <label className="flex flex-col gap-1 text-text-muted">
                  <span>
                    Fonction (facultatif)
                  </span>
                  {j.fonctions.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {j.fonctions.map((f) => (
                        <button
                          key={f.fonction}
                          type="button"
                          onClick={() => setFonction(f.fonction)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            fonction === f.fonction ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:border-coral/60"
                          )}
                        >
                          {f.fonction} {f.places}/{f.besoin}
                        </button>
                      ))}
                    </span>
                  )}
                  <input
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    list={`fonctions-projet-${projetId}`}
                    placeholder="Ex. Client café"
                    className={champ}
                  />
                </label>
                <label className="flex flex-col gap-1 text-text-muted">
                  <span>
                    Cachet <span className="text-danger">*</span>
                  </span>
                  <select value={cachet} onChange={(e) => setCachet(e.target.value as Cachet | "")} className={champ}>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {CACHETS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEnvoi(null)}
                    className="rounded-full border border-border-strong px-3 py-1.5 font-medium hover:border-coral/60"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={pending || !cachet || aEnvoyer.length === 0}
                    title={!cachet ? "Choisis un cachet" : undefined}
                    onClick={() => envoyer(j, aEnvoyer.map((s) => s.id))}
                    className="rounded-full bg-coral px-3 py-1.5 font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
                  >
                    {pending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            ) : selectionFigee.length > 0 ? (
              <button
                type="button"
                disabled={pasEncore.length === 0}
                onClick={() => demarrer(j.id)}
                className="rounded-full bg-coral px-3 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:bg-ink-raised-2 disabled:text-text-muted"
              >
                📅 {pasEncore.length === 0
                  ? "Déjà en booking"
                  : `Envoyer ${dispo.length} en booking${pasDispo.length > 0 ? ` (+${pasDispo.length} pas dispo)` : ""}`}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
