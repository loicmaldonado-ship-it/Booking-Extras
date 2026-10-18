"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatDateLong } from "@/lib/format-date";
import { envoyerCandidaturesDansJour, envoyerJourAuTournage } from "@/lib/candidatures/jours";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { statutLabel, statutTone, type BookingStatut } from "@/lib/bookings/types";
import { Badge } from "@/components/ui/card";
import type { JourCandidature } from "@/components/candidatures/jour-chips";

export type JourPanneau = {
  id: string;
  date: string;
  // Somme des besoins saisis dans Bookings (null = rien de saisi).
  besoin: number | null;
  // Bookings de la journée hors annulé·es / indispos.
  dansLaJournee: number;
  stats: { confirmes: number; proposes: number; per: number };
  fonctions: { fonction: string; besoin: number; places: number }[];
  gens: { nom: string; statut: BookingStatut; fonction: string | null }[];
  // Candidat·es « prévu·es » ce jour (pastilles des cartes), pas encore
  // dans la journée.
  prevusAEnvoyer: number;
  prevus: number;
  dispoHref: string;
  dispoActif: boolean;
  prevusHref: string;
};

export type SelectionJours = { id: string; nom: string; jours: JourCandidature[] };

const champ = "w-full rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral";

// Panneau de droite de Candidatures : un bloc par date de l'annonce, avec
// la jauge besoin / présent·es, le détail de la journée sur demande, et
// l'envoi des profils cochés dans ce jour (confirmation sur place).
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
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<{ jourId: string; mode: "selection" | "prevus" } | null>(null);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [aussiPasDispo, setAussiPasDispo] = useState(false);
  const [resultat, setResultat] = useState<{ jourId: string; ok: number; deja: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [tousLesGens, setTousLesGens] = useState<string | null>(null);

  function demarrer(jourId: string, mode: "selection" | "prevus") {
    setEnvoi({ jourId, mode });
    setResultat(null);
    setAussiPasDispo(false);
  }

  function envoyer(jour: JourPanneau, ids: string[]) {
    const mode = envoi?.mode;
    startTransition(async () => {
      const res =
        mode === "prevus"
          ? await envoyerJourAuTournage(jour.id, fonction, cachet)
          : await envoyerCandidaturesDansJour(jour.id, ids, fonction, cachet);
      setResultat({ jourId: jour.id, ...res });
      if (!res.error) {
        setEnvoi(null);
        onEnvoye();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Coche des profils puis envoie-les dans un jour : ils quittent Candidatures et arrivent dans la journée (en PER,
        rien n&apos;est envoyé aux figurant·es). Besoins saisis dans Bookings.
      </p>
      {jours.map((j) => {
        const pasEncore = selection.filter((s) => !s.jours.find((x) => x.id === j.id)?.dansLaJournee);
        const dispo = pasEncore.filter((s) => s.jours.find((x) => x.id === j.id)?.disponible);
        const pasDispo = pasEncore.filter((s) => !s.jours.find((x) => x.id === j.id)?.disponible);
        const aEnvoyer = aussiPasDispo ? pasEncore : dispo;
        const estOuvert = ouvert === j.id;
        const enCours = envoi?.jourId === j.id;
        const complet = j.besoin !== null && j.dansLaJournee >= j.besoin;
        const pc = j.besoin ? Math.min(100, (j.dansLaJournee / j.besoin) * 100) : 0;
        const gens = tousLesGens === j.id ? j.gens : j.gens.slice(0, 8);
        return (
          <div
            key={j.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-ink p-3",
              estOuvert || enCours ? "border-coral/70" : "border-border"
            )}
          >
            <button
              type="button"
              onClick={() => setOuvert(estOuvert ? null : j.id)}
              aria-expanded={estOuvert}
              className="flex flex-col gap-1.5 text-left"
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                <span>
                  {estOuvert ? "▾" : "▸"} {formatDateLong(j.date)}
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
                    ? `${j.dansLaJournee} dans la journée`
                    : complet
                      ? "✓ Complet"
                      : `Il manque ${j.besoin - j.dansLaJournee}`}
                </span>
                {selection.length > 0 && (
                  <span>
                    {dispo.length}/{selection.length} coché{selection.length > 1 ? "s" : ""} dispo
                  </span>
                )}
              </span>
            </button>

            {estOuvert && (
              <div className="flex flex-col gap-2 border-t border-border pt-2 text-xs">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="confirme">{j.stats.confirmes} confirmé{j.stats.confirmes > 1 ? "s" : ""}</Badge>
                  <Badge tone="yellow">{j.stats.proposes} proposé{j.stats.proposes > 1 ? "s" : ""}</Badge>
                  <Badge>{j.stats.per} PER</Badge>
                </div>
                {j.fonctions.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {j.fonctions.map((f) => (
                      <div key={f.fonction} className="flex justify-between gap-2">
                        <span>{f.fonction}</span>
                        <b className={cn("tabular-nums", f.places >= f.besoin ? "text-turquoise" : "text-yellow")}>
                          {f.places}/{f.besoin}
                        </b>
                      </div>
                    ))}
                  </div>
                )}
                {j.gens.length > 0 ? (
                  <div className="flex flex-col gap-0.5 border-t border-border pt-2">
                    {gens.map((g, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {g.nom}
                          {g.fonction && <span className="text-text-muted"> · {g.fonction}</span>}
                        </span>
                        <Badge tone={statutTone(g.statut)}>{g.statut === "envoyé" ? "PER" : statutLabel(g.statut)}</Badge>
                      </div>
                    ))}
                    {j.gens.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setTousLesGens(tousLesGens === j.id ? null : j.id)}
                        className="self-start font-medium text-coral hover:underline"
                      >
                        {tousLesGens === j.id ? "Réduire" : `… et ${j.gens.length - 8} autres`}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-text-muted">Personne dans la journée pour l&apos;instant.</p>
                )}
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <Link href={j.dispoHref} scroll={false} className="font-medium text-coral hover:underline">
                    {j.dispoActif ? "✓ Seulement les dispo ce jour (retirer)" : "Ne montrer que les dispo ce jour"}
                  </Link>
                  {j.prevus > 0 && (
                    <Link href={j.prevusHref} scroll={false} className="font-medium text-coral hover:underline">
                      Voir les {j.prevus} prévu·e{j.prevus > 1 ? "s" : ""} ce jour
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Link
                    href={`/bookings/documents/trombis?projet_id=${projetId}&date=${j.date}&statut=tous`}
                    target="_blank"
                    className="rounded-lg border border-border-strong px-2 py-1.5 text-center font-medium hover:border-coral/60"
                  >
                    🖼️ Trombi du jour
                  </Link>
                  <Link
                    href={`/bookings/documents?projet_id=${projetId}&date=${j.date}&onglet=messages`}
                    className="rounded-lg border border-border-strong px-2 py-1.5 text-center font-medium hover:border-coral/60"
                  >
                    💬 Messages du jour
                  </Link>
                </div>
                <Link
                  href={`/bookings/documents?projet_id=${projetId}&date=${j.date}`}
                  className="rounded-lg border border-border-strong px-2 py-1.5 text-center font-medium hover:border-coral/60"
                >
                  Ouvrir la journée dans Bookings →
                </Link>
              </div>
            )}

            {resultat?.jourId === j.id && (
              <p className={cn("text-xs", resultat.error ? "text-danger" : "font-medium text-turquoise")}>
                {resultat.error ??
                  `✓ ${resultat.ok} envoyé${resultat.ok > 1 ? "s" : ""} dans la journée${
                    resultat.deja > 0 ? ` (${resultat.deja} y étai${resultat.deja > 1 ? "ent" : "t"} déjà)` : ""
                  }.`}
              </p>
            )}

            {enCours ? (
              <div className="flex flex-col gap-2 rounded-lg border border-coral/50 bg-coral/5 p-2.5 text-xs">
                <p className="text-sm">
                  {envoi.mode === "prevus" ? (
                    <>
                      Envoyer les <b>{j.prevusAEnvoyer}</b> prévu·e{j.prevusAEnvoyer > 1 ? "s" : ""} dans la journée du{" "}
                      {formatDayMonth(j.date)} ?
                    </>
                  ) : (
                    <>
                      Envoyer <b>{aEnvoyer.length}</b> personne{aEnvoyer.length > 1 ? "s" : ""} dans la journée du{" "}
                      {formatDayMonth(j.date)} ?
                    </>
                  )}
                </p>
                {envoi.mode === "selection" && pasDispo.length > 0 && (
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
                  Fonction (optionnel)
                  <input
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    list={`fonctions-projet-${projetId}`}
                    placeholder="Ex. Client café"
                    className={champ}
                  />
                </label>
                <label className="flex flex-col gap-1 text-text-muted">
                  Cachet (optionnel)
                  <select value={cachet} onChange={(e) => setCachet(e.target.value as Cachet | "")} className={champ}>
                    <option value="">—</option>
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
                    disabled={pending || (envoi.mode === "selection" && aEnvoyer.length === 0)}
                    onClick={() => envoyer(j, aEnvoyer.map((s) => s.id))}
                    className="rounded-full bg-coral px-3 py-1.5 font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
                  >
                    {pending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            ) : selection.length > 0 ? (
              <button
                type="button"
                disabled={pasEncore.length === 0}
                onClick={() => demarrer(j.id, "selection")}
                className="rounded-full bg-coral px-3 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:bg-ink-raised-2 disabled:text-text-muted"
              >
                📅 {pasEncore.length === 0
                  ? "Déjà dans ce jour"
                  : `Envoyer ${dispo.length} dans ce jour${pasDispo.length > 0 ? ` (+${pasDispo.length} pas dispo)` : ""}`}
              </button>
            ) : j.prevusAEnvoyer > 0 ? (
              <button
                type="button"
                onClick={() => demarrer(j.id, "prevus")}
                className="rounded-full border-2 border-coral px-3 py-1.5 text-sm font-semibold text-coral hover:bg-coral/10"
              >
                📅 Envoyer les {j.prevusAEnvoyer} prévu·e{j.prevusAEnvoyer > 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
