"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format-date";
import { envoyerCandidaturesDansJour, setCandidaturesJourBulk } from "@/lib/candidatures/jours";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { statutLabel, statutTone } from "@/lib/bookings/types";
import { Badge } from "@/components/ui/card";
import type { JourPanneau } from "@/components/candidatures/jours-panneau";

// Une candidature montrée dans la journée ouverte (dans la journée
// prévisionnelle, ou profil trié à ajouter).
export type CarteJour = {
  id: string;
  nom: string;
  meta: string;
  portraitUrl: string | null;
  dispo: boolean;
};

const lien = "rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60";

// Bandeau des journées en haut de Candidatures : une grande carte par date
// de l'annonce (dans la journée prévisionnelle, en booking, besoin).
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
                  {j.prevusAEnvoyer}
                  <span className="text-sm font-normal text-text-muted"> prévu·e{j.prevusAEnvoyer > 1 ? "s" : ""}</span>
                </span>
              </span>
              {j.besoin !== null && (
                <span className="h-2 overflow-hidden rounded-full bg-ink-raised-2" title="En booking face au besoin">
                  <span className={cn("block h-full rounded-full", complet ? "bg-turquoise" : "bg-yellow")} style={{ width: `${pc}%` }} />
                </span>
              )}
              <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="rounded-full bg-yellow/20 px-2 py-0.5 text-yellow">⏳ {j.prevusAEnvoyer} dans la journée</span>
                <span className="rounded-full bg-turquoise/15 px-2 py-0.5 text-turquoise">
                  ✓ {j.dansLaJournee}
                  {j.besoin !== null && ` / ${j.besoin}`} en booking
                </span>
              </span>
              <span className="text-xs font-semibold text-coral">{j.vu ? "▾ Journée ouverte" : "Ouvrir la journée →"}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// La journée ouverte, à la place de la liste des candidatures. Le focus est
// sur les profils triés : ceux déplacés dans la journée (prévisionnel), à
// envoyer en booking ; on en ajoute parmi les profils triés dispo ce jour.
// Les profils déjà en booking sont en simple consultation.
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
  // Profils triés (rangés dans un onglet, hors OUT) dispo ce jour.
  dispos: CarteJour[];
  disposEnPlus: number;
}) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"journee" | "ajouter" | "booking">("journee");
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const liste = onglet === "journee" ? prevus : onglet === "ajouter" ? dispos : [];
  // Dans la journée sans rien de coché : l'envoi porte sur tout le monde.
  const choisis = coches.size > 0 ? liste.filter((c) => coches.has(c.id)) : onglet === "journee" ? prevus : [];

  function changer(o: typeof onglet) {
    setOnglet(o);
    setCoches(new Set());
    setConfirmer(false);
    setMessage(null);
  }

  function basculer(id: string) {
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apres(texte: string) {
    setMessage({ ok: true, texte });
    setCoches(new Set());
    setConfirmer(false);
    router.refresh();
  }

  function envoyerEnBooking() {
    startTransition(async () => {
      const res = await envoyerCandidaturesDansJour(jour.id, choisis.map((c) => c.id), fonction, cachet);
      if (res.error) setMessage({ ok: false, texte: res.error });
      else
        apres(
          `✓ ${res.ok} envoyé${res.ok > 1 ? "s" : ""} en booking${res.deja > 0 ? ` (${res.deja} y étai${res.deja > 1 ? "ent" : "t"} déjà)` : ""}.`
        );
    });
  }

  function deplacer(dansLaJournee: boolean) {
    startTransition(async () => {
      const res = await setCandidaturesJourBulk(choisis.map((c) => c.id), jour.id, dansLaJournee);
      if (res.error) setMessage({ ok: false, texte: res.error });
      else {
        apres(
          dansLaJournee
            ? `✓ ${res.n} déplacé${(res.n ?? 0) > 1 ? "s" : ""} dans la journée.`
            : `✓ ${res.n} retiré${(res.n ?? 0) > 1 ? "s" : ""} de la journée.`
        );
        if (dansLaJournee) setOnglet("journee");
      }
    });
  }

  const groupes = new Map<string, JourPanneau["gens"]>();
  for (const g of jour.gens) groupes.set(g.fonction?.trim() || "", [...(groupes.get(g.fonction?.trim() || "") ?? []), g]);
  const ordre = Array.from(groupes.keys()).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")));
  const besoinDe = (f: string) => jour.fonctions.find((x) => x.fonction.toLowerCase() === f.toLowerCase());

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-coral/60 bg-ink-raised p-4" aria-label={`Journée du ${formatDateLong(jour.date)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">📅 {formatDateLong(jour.date)}</h2>
          <p className="text-sm text-text-muted">
            ⏳ {prevus.length} dans la journée (prévisionnel) · ✓ {jour.dansLaJournee}
            {jour.besoin !== null && ` / ${jour.besoin}`} en booking
          </p>
        </div>
        <Link href={fermerHref} scroll={false} className="rounded-full border-2 border-border-strong px-4 py-2 text-sm font-semibold hover:border-coral/60">
          ← Revenir aux candidatures
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["journee", `⏳ Dans la journée (${prevus.length})`],
            ["ajouter", `＋ Ajouter des profils triés (${dispos.length + disposEnPlus})`],
            ["booking", `👁 Déjà en booking (${jour.dansLaJournee})`],
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
              onglet === k
                ? k === "booking"
                  ? "border-turquoise bg-turquoise/15 text-turquoise"
                  : "border-coral bg-coral text-ink"
                : "border-border-strong hover:border-coral/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className={cn("text-sm", message.ok ? "font-medium text-turquoise" : "text-danger")}>{message.texte}</p>}

      {onglet === "booking" &&
        (jour.gens.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Personne en booking sur cette journée pour l&apos;instant.</p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              Consultation : ces profils sont déjà en booking, ils se gèrent dans la journée de Bookings.
            </p>
            {ordre.map((f) => {
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
                      <div key={g.bookingId} className="flex flex-col gap-1.5 rounded-xl border border-border bg-ink p-1.5 text-center opacity-90">
                        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                          {g.portraitUrl && <Image src={g.portraitUrl} alt={g.nom} fill sizes="160px" className="object-cover" />}
                        </div>
                        <span className="truncate text-sm font-medium">{g.nom}</span>
                        <Badge tone={statutTone(g.statut)}>{g.statut === "envoyé" ? "PER" : statutLabel(g.statut)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ))}

      {onglet !== "booking" && (
        <>
          <p className="text-sm text-text-muted">
            {onglet === "journee"
              ? "Profils déplacés dans cette journée (prévisionnel, rien n'est encore dans Bookings). Coche ceux à envoyer en booking, ou envoie-les tous."
              : "Profils triés (Retenu, Peut-être…) qui se sont dit·es dispo ce jour. Coche puis déplace-les dans la journée."}
          </p>
          {liste.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              {onglet === "journee"
                ? "Personne dans cette journée pour l'instant : va dans « Ajouter des profils triés »."
                : "Aucun profil trié dispo ce jour. Range d'abord des candidat·es dans Retenu, Peut-être…"}
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
          {onglet === "ajouter" && disposEnPlus > 0 && (
            <p className="text-xs text-text-muted">
              … et {disposEnPlus} autre{disposEnPlus > 1 ? "s" : ""} : affine depuis la liste (« Revenir aux candidatures »).
            </p>
          )}

          <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border-2 border-coral bg-ink p-3 shadow-lg">
            {onglet === "ajouter" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm">{coches.size > 0 ? `${coches.size} coché${coches.size > 1 ? "s" : ""}` : "Coche des profils"}</b>
                <button
                  type="button"
                  disabled={pending || choisis.length === 0}
                  onClick={() => deplacer(true)}
                  className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:bg-ink-raised-2 disabled:text-text-muted"
                >
                  📅 Déplacer {choisis.length || ""} dans cette journée
                </button>
              </div>
            ) : confirmer && choisis.length > 0 ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  Envoyer <b>{choisis.length}</b> personne{choisis.length > 1 ? "s" : ""} en booking le {formatDateLong(jour.date)} ? (en
                  PER, rien n&apos;est envoyé aux figurant·es)
                </p>
                <div className="flex flex-wrap items-end gap-3">
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
                  <label className="flex flex-col gap-1 text-xs text-text-muted">
                    <span>Fonction (facultatif)</span>
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
                  <button type="button" disabled={pending} onClick={() => setConfirmer(false)} className={lien}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={pending || !cachet}
                    onClick={envoyerEnBooking}
                    className="rounded-full bg-turquoise px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {pending ? "Envoi…" : "📋 Envoyer en booking"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm">
                  {coches.size > 0 ? `${coches.size} coché${coches.size > 1 ? "s" : ""}` : `${prevus.length} dans la journée`}
                </b>
                <span className="flex flex-wrap gap-2">
                  {coches.size > 0 && (
                    <button type="button" disabled={pending} onClick={() => deplacer(false)} className={lien}>
                      Retirer de la journée
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={choisis.length === 0}
                    onClick={() => {
                      setMessage(null);
                      setConfirmer(true);
                    }}
                    className="rounded-full bg-turquoise px-4 py-2 text-sm font-semibold text-white disabled:bg-ink-raised-2 disabled:text-text-muted"
                  >
                    📋 Envoyer {choisis.length || ""} en booking
                  </button>
                </span>
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
