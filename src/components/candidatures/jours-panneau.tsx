"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
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
  gens: { bookingId: string; nom: string; statut: BookingStatut; fonction: string | null; portraitUrl: string | null }[];
  // Annulé·es et indispos de ce jour (pas dans le trombi).
  horsJournee: number;
  // Jour ouvert en grand au-dessus des cartes.
  vu: boolean;
  vuHref: string;
  // Candidat·es « prévu·es » ce jour (pastilles des cartes), pas encore
  // dans la journée.
  prevusAEnvoyer: number;
  prevus: number;
  prevusIds: string[];
  dispoHref: string;
  dispoActif: boolean;
  prevusHref: string;
};

export type SelectionJours = { id: string; nom: string; jours: JourCandidature[] };

const champ = "w-full rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral";

// Panneau de droite de Candidatures : un bloc par date de l'annonce, avec
// la jauge besoin / présent·es, et l'envoi des profils cochés dans ce jour
// (confirmation sur place). Un clic sur le jour l'ouvre en grand (trombi)
// au-dessus des cartes.
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
  const [envoi, setEnvoi] = useState<{ jourId: string; mode: "selection" | "prevus" } | null>(null);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [aussiPasDispo, setAussiPasDispo] = useState(false);
  const [resultat, setResultat] = useState<{ jourId: string; ok: number; deja: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
        const estOuvert = j.vu;
        const enCours = envoi?.jourId === j.id;
        const complet = j.besoin !== null && j.dansLaJournee >= j.besoin;
        const pc = j.besoin ? Math.min(100, (j.dansLaJournee / j.besoin) * 100) : 0;
        return (
          <div
            key={j.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-ink p-3",
              estOuvert || enCours ? "border-coral/70" : "border-border"
            )}
          >
            <Link
              href={j.vuHref}
              scroll={false}
              aria-current={estOuvert ? "true" : undefined}
              className="flex flex-col gap-1.5 text-left"
            >
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
            </Link>

            <Link
              href={j.vuHref}
              scroll={false}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-center text-xs font-medium",
                estOuvert ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
              )}
            >
              {estOuvert ? "✓ Ouvert en grand · fermer" : `🖼️ Voir qui est dans ce jour (${j.dansLaJournee})`}
            </Link>

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

// Le jour ouvert en grand, au-dessus des cartes : un vrai trombi des
// personnes de la journée, groupé par fonction, avec leur statut.
export function JourneeEnGrand({
  jour,
  projetId,
  fermerHref,
}: {
  jour: JourPanneau;
  projetId: string;
  fermerHref: string;
}) {
  const groupes = new Map<string, JourPanneau["gens"]>();
  for (const g of jour.gens) {
    const cle = g.fonction?.trim() || "";
    groupes.set(cle, [...(groupes.get(cle) ?? []), g]);
  }
  const ordre = Array.from(groupes.keys()).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")));
  const besoinDe = (f: string) => jour.fonctions.find((x) => x.fonction.toLowerCase() === f.toLowerCase());
  const complet = jour.besoin !== null && jour.dansLaJournee >= jour.besoin;
  const classeLien = "rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-coral/60 bg-ink-raised p-4" aria-label={`Journée du ${formatDateLong(jour.date)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">📅 {formatDateLong(jour.date)}</h2>
          <p className={cn("text-sm", complet ? "font-medium text-turquoise" : "text-text-muted")}>
            {jour.dansLaJournee} dans la journée
            {jour.besoin !== null && ` sur ${jour.besoin} demandé·es`}
            {jour.besoin !== null && (complet ? " · ✓ Complet" : ` · il manque ${jour.besoin - jour.dansLaJournee}`)}
            {jour.horsJournee > 0 && ` · ${jour.horsJournee} annulé·e ou indispo`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone="confirme">{jour.stats.confirmes} confirmé{jour.stats.confirmes > 1 ? "s" : ""}</Badge>
            <Badge tone="yellow">{jour.stats.proposes} proposé{jour.stats.proposes > 1 ? "s" : ""}</Badge>
            <Badge>{jour.stats.per} PER</Badge>
          </div>
        </div>
        <Link href={fermerHref} scroll={false} className="flex items-center gap-1 rounded-full border border-border-strong px-3 py-1.5 text-sm font-medium hover:border-coral/60">
          Fermer <X size={14} />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={jour.dispoHref} scroll={false} className={cn(classeLien, jour.dispoActif && "border-coral bg-coral/15 text-coral")}>
          {jour.dispoActif ? "✓ Seulement les candidat·es dispo ce jour" : "Montrer les candidat·es dispo ce jour"}
        </Link>
        {jour.prevus > 0 && (
          <Link href={jour.prevusHref} scroll={false} className={classeLien}>
            Voir les {jour.prevus} prévu·e{jour.prevus > 1 ? "s" : ""}
          </Link>
        )}
        <Link href={`/bookings/documents/trombis?projet_id=${projetId}&date=${jour.date}&statut=tous`} target="_blank" className={classeLien}>
          🖼️ Trombi à imprimer
        </Link>
        <Link href={`/bookings/documents?projet_id=${projetId}&date=${jour.date}&onglet=messages`} className={classeLien}>
          💬 Messages du jour
        </Link>
        <Link href={`/bookings/documents?projet_id=${projetId}&date=${jour.date}`} className={classeLien}>
          Ouvrir la journée dans Bookings →
        </Link>
      </div>

      {jour.gens.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          Personne dans cette journée pour l&apos;instant. Coche des profils ci-dessous puis « Envoyer dans ce jour ».
        </p>
      ) : (
        ordre.map((f) => {
          const gens = groupes.get(f)!;
          const b = f ? besoinDe(f) : undefined;
          return (
            <div key={f || "sans"} className="flex flex-col gap-2">
              <h3 className="flex items-baseline gap-2 border-b border-border pb-1 text-sm font-semibold">
                {f || "Sans fonction"}
                <span className={cn("tabular-nums", b ? (gens.length >= b.besoin ? "text-turquoise" : "text-yellow") : "text-text-muted")}>
                  {gens.length}
                  {b && ` / ${b.besoin}`}
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
                {gens.map((g) => (
                  <Link
                    key={g.bookingId}
                    href={`/bookings/${g.bookingId}`}
                    className="flex flex-col gap-1.5 rounded-xl border border-border bg-ink p-1.5 text-center hover:border-coral/60"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                      {g.portraitUrl && <Image src={g.portraitUrl} alt={g.nom} fill sizes="160px" className="object-cover" />}
                    </div>
                    <span className="truncate text-sm font-medium">{g.nom}</span>
                    <Badge tone={statutTone(g.statut)}>{g.statut === "envoyé" ? "PER" : statutLabel(g.statut)}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      )}
      {/* Besoins sans personne encore. */}
      {jour.fonctions.filter((x) => !ordre.some((f) => f.toLowerCase() === x.fonction.toLowerCase())).length > 0 && (
        <p className="text-xs text-text-muted">
          Encore personne pour :{" "}
          {jour.fonctions
            .filter((x) => !ordre.some((f) => f.toLowerCase() === x.fonction.toLowerCase()))
            .map((x) => `${x.fonction} (0 / ${x.besoin})`)
            .join(" · ")}
        </p>
      )}
    </section>
  );
}
