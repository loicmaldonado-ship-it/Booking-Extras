"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format-date";
import { envoyerCandidaturesDansJour } from "@/lib/candidatures/jours";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { statutLabel, statutTone } from "@/lib/bookings/types";
import { Badge } from "@/components/ui/card";
import type { JourPanneau } from "@/components/candidatures/jours-panneau";

// Une candidature montrée dans la journée ouverte (prévue ou dispo).
export type CarteJour = {
  id: string;
  nom: string;
  meta: string;
  portraitUrl: string | null;
  dispo: boolean;
};

const lien = "rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60";

// Bandeau des journées en haut de Candidatures : une grande carte par date
// de l'annonce (jauge, dans la journée de booking, en cours de choix).
export function BandeauJournees({ jours }: { jours: JourPanneau[] }) {
  return (
    <section aria-label="Journées de l'annonce" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">📅 Les journées de l&apos;annonce</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {jours.map((j) => {
          const complet = j.besoin !== null && j.dansLaJournee >= j.besoin;
          const pc = j.besoin ? Math.min(100, (j.dansLaJournee / j.besoin) * 100) : 0;
          return (
            <Link
              key={j.id}
              href={j.vuHref}
              scroll={false}
              aria-current={j.vu ? "page" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border-2 bg-ink-raised p-3 transition-colors",
                j.vu ? "border-coral ring-2 ring-coral/30" : "border-border-strong hover:border-coral/60"
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <b className="text-base">📅 {formatDateLong(j.date)}</b>
                <span className="text-xl font-semibold tabular-nums">
                  {j.dansLaJournee}
                  {j.besoin !== null && <span className="text-sm font-normal text-text-muted"> / {j.besoin}</span>}
                </span>
              </span>
              {j.besoin !== null && (
                <span className="h-2 overflow-hidden rounded-full bg-ink-raised-2">
                  <span className={cn("block h-full rounded-full", complet ? "bg-turquoise" : "bg-yellow")} style={{ width: `${pc}%` }} />
                </span>
              )}
              <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="rounded-full bg-turquoise px-2 py-0.5 text-white">✓ {j.dansLaJournee} dans la journée de booking</span>
                {j.prevusAEnvoyer > 0 && (
                  <span className="rounded-full bg-yellow/20 px-2 py-0.5 text-yellow">⏳ {j.prevusAEnvoyer} prévu·e{j.prevusAEnvoyer > 1 ? "s" : ""}</span>
                )}
                {j.besoin !== null &&
                  (complet ? (
                    <span className="rounded-full bg-turquoise/15 px-2 py-0.5 text-turquoise">Complet</span>
                  ) : (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-danger">Il manque {j.besoin - j.dansLaJournee}</span>
                  ))}
              </span>
              <span className="text-xs font-semibold text-coral">{j.vu ? "▾ Journée ouverte" : "Ouvrir la journée →"}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// La journée ouverte, à la place de la liste des candidatures : qui est
// dans la journée de booking, qui est prévu (en cours de choix), et les
// candidat·es dispo ce jour à choisir, avec l'envoi dans la journée de
// booking (fonction et cachet obligatoires).
export function ModeJournee({
  jour,
  projetId,
  fermerHref,
  prevus,
  dispos,
  disposEnPlus,
}: {
  jour: JourPanneau;
  projetId: string;
  fermerHref: string;
  prevus: CarteJour[];
  dispos: CarteJour[];
  // Dispo au-delà de ceux affichés (liste plafonnée).
  disposEnPlus: number;
}) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"dans" | "prevus" | "choisir">(prevus.length > 0 ? "prevus" : "dans");
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [confirmer, setConfirmer] = useState(false);
  const [resultat, setResultat] = useState<{ ok: number; deja: number; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const liste = onglet === "prevus" ? prevus : onglet === "choisir" ? dispos : [];
  // Onglet « prévus » sans rien de coché : on envoie tous les prévus.
  const aEnvoyer = coches.size > 0 ? liste.filter((c) => coches.has(c.id)) : onglet === "prevus" ? prevus : [];

  function changer(o: typeof onglet) {
    setOnglet(o);
    setCoches(new Set());
    setConfirmer(false);
    setResultat(null);
  }

  function basculer(id: string) {
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function envoyer() {
    startTransition(async () => {
      const res = await envoyerCandidaturesDansJour(jour.id, aEnvoyer.map((c) => c.id), fonction, cachet);
      setResultat(res);
      if (!res.error) {
        setCoches(new Set());
        setConfirmer(false);
        router.refresh();
      }
    });
  }

  const groupes = new Map<string, JourPanneau["gens"]>();
  for (const g of jour.gens) groupes.set(g.fonction?.trim() || "", [...(groupes.get(g.fonction?.trim() || "") ?? []), g]);
  const ordre = Array.from(groupes.keys()).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")));
  const besoinDe = (f: string) => jour.fonctions.find((x) => x.fonction.toLowerCase() === f.toLowerCase());
  const complet = jour.besoin !== null && jour.dansLaJournee >= jour.besoin;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-coral/60 bg-ink-raised p-4" aria-label={`Journée du ${formatDateLong(jour.date)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">📅 {formatDateLong(jour.date)}</h2>
          <p className={cn("text-sm", complet ? "font-medium text-turquoise" : "text-text-muted")}>
            {jour.dansLaJournee} dans la journée de booking
            {jour.besoin !== null && ` sur ${jour.besoin} demandé·es`}
            {jour.besoin !== null && (complet ? " · ✓ Complet" : ` · il manque ${jour.besoin - jour.dansLaJournee}`)}
          </p>
        </div>
        <Link href={fermerHref} scroll={false} className="rounded-full border-2 border-border-strong px-4 py-2 text-sm font-semibold hover:border-coral/60">
          ← Revenir aux candidatures
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["dans", `✓ Dans la journée de booking (${jour.dansLaJournee})`],
            ["prevus", `⏳ Prévu·es, en cours de choix (${prevus.length})`],
            ["choisir", `＋ Choisir parmi les dispo (${dispos.length + disposEnPlus})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={onglet === k}
            onClick={() => changer(k)}
            className={cn(
              "rounded-xl border-2 px-3 py-2 text-sm font-semibold",
              onglet === k ? "border-coral bg-coral text-ink" : "border-border-strong hover:border-coral/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === "dans" &&
        (jour.gens.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Personne dans la journée de booking pour l&apos;instant : va dans « Prévu·es » ou « Choisir parmi les dispo ».
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
        ))}

      {onglet !== "dans" && (
        <>
          <p className="text-sm text-text-muted">
            {onglet === "prevus"
              ? "Prévu·es dans cette journée mais pas encore envoyé·es. Coche ceux à envoyer, ou envoie-les tous."
              : "Candidat·es qui se sont dit·es dispo ce jour et ne sont pas encore dans la journée. Coche puis envoie."}
          </p>
          {liste.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              {onglet === "prevus" ? "Personne de prévu dans cette journée pour l'instant." : "Personne de dispo à choisir."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-8">
              {liste.map((c) => {
                const coche = coches.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => basculer(c.id)}
                    aria-pressed={coche}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-xl border-2 p-1.5 text-center",
                      coche ? "border-coral bg-coral/10" : "border-border bg-ink hover:border-coral/60"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-bold",
                        coche ? "border-coral bg-coral text-ink" : "border-white/80 bg-ink/60 text-transparent"
                      )}
                    >
                      ✓
                    </span>
                    <span className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                      {c.portraitUrl && <Image src={c.portraitUrl} alt="" fill sizes="160px" className="object-cover" />}
                    </span>
                    <span className="truncate text-sm font-medium">{c.nom}</span>
                    <span className="truncate text-[11px] text-text-muted">{c.meta}</span>
                    {!c.dispo && <span className="text-[11px] font-medium text-danger">S&apos;est dit·e pas dispo</span>}
                  </button>
                );
              })}
            </div>
          )}
          {onglet === "choisir" && disposEnPlus > 0 && (
            <p className="text-xs text-text-muted">
              … et {disposEnPlus} autre{disposEnPlus > 1 ? "s" : ""} : affine avec les filtres de la liste (« Revenir aux candidatures », puis « Dispo le … »).
            </p>
          )}

          <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border-2 border-coral bg-ink p-3 shadow-lg">
            {resultat && (
              <p className={cn("text-sm", resultat.error ? "text-danger" : "font-medium text-turquoise")}>
                {resultat.error ??
                  `✓ ${resultat.ok} envoyé${resultat.ok > 1 ? "s" : ""} dans la journée de booking${
                    resultat.deja > 0 ? ` (${resultat.deja} y étai${resultat.deja > 1 ? "ent" : "t"} déjà)` : ""
                  }.`}
              </p>
            )}
            {confirmer && aEnvoyer.length > 0 ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  Envoyer <b>{aEnvoyer.length}</b> personne{aEnvoyer.length > 1 ? "s" : ""} dans la journée de booking du{" "}
                  {formatDateLong(jour.date)} ? (en PER, rien n&apos;est envoyé aux figurant·es)
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-text-muted">
                    <span>
                      Fonction <span className="text-danger">*</span>
                    </span>
                    {jour.fonctions.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {jour.fonctions.map((f) => (
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
                      className="w-56 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm text-text outline-none focus:border-coral"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-muted">
                    <span>
                      Cachet <span className="text-danger">*</span>
                    </span>
                    <select
                      value={cachet}
                      onChange={(e) => setCachet(e.target.value as Cachet | "")}
                      className="rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm text-text"
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
                  </label>
                  <button type="button" disabled={pending} onClick={() => setConfirmer(false)} className={lien}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={pending || !fonction.trim() || !cachet}
                    onClick={envoyer}
                    className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
                  >
                    {pending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm">
                  {coches.size > 0
                    ? `${coches.size} coché${coches.size > 1 ? "s" : ""}`
                    : onglet === "prevus"
                      ? `${prevus.length} prévu·e${prevus.length > 1 ? "s" : ""}`
                      : "Coche des profils"}
                </b>
                <button
                  type="button"
                  disabled={aEnvoyer.length === 0}
                  onClick={() => {
                    setResultat(null);
                    setConfirmer(true);
                  }}
                  className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:bg-ink-raised-2 disabled:text-text-muted"
                >
                  📅 Envoyer {aEnvoyer.length || ""} dans la journée de booking
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Link href={`/bookings/documents/trombis?projet_id=${projetId}&date=${jour.date}&statut=tous`} target="_blank" className={lien}>
          🖼️ Trombi à imprimer
        </Link>
        <Link href={`/bookings/documents?projet_id=${projetId}&date=${jour.date}&onglet=messages`} className={lien}>
          💬 Messages du jour
        </Link>
        <Link href={`/bookings/documents?projet_id=${projetId}&date=${jour.date}`} className={lien}>
          Ouvrir la journée dans Bookings →
        </Link>
      </div>
    </section>
  );
}
