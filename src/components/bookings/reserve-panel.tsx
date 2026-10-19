"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { Button } from "@/components/ui/button";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { retirerDeLaReserve } from "@/lib/reserve/actions";
import { formatDateShort, formatDayMonth } from "@/lib/format-date";
import type { ReserveProfil } from "@/lib/reserve/data";

// La réserve du projet : les profils mis de côté (depuis Candidatures ou
// Bookings) qu'on recontactera peut-être. Chacun montre où il a postulé et
// les dates qu'il a données comme dispo ou pas.
export function ReservePanel({
  profils,
  projet,
}: {
  profils: ReserveProfil[];
  projet: { id: string; nom: string };
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [envoi, setEnvoi] = useState(false);
  const [dateFiltre, setDateFiltre] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  // Classés par dispo : ceux qui ont le plus de jours dispo d'abord, les sans
  // réponse à la fin ; à égalité, l'ordre alphabétique d'origine. Un clic sur
  // une date ne garde que ceux dispo ce jour-là.
  const nbDispo = (p: ReserveProfil) => p.dispos.filter((d) => d.disponible === true).length;
  const dateCompte = new Map<string, number>();
  for (const p of profils) for (const d of p.dispos) if (d.disponible === true) dateCompte.set(d.date, (dateCompte.get(d.date) ?? 0) + 1);
  const datesConnues = Array.from(dateCompte.keys()).sort();
  const affiches = profils
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !dateFiltre || p.dispos.some((d) => d.date === dateFiltre && d.disponible === true))
    .sort((a, b) => nbDispo(b.p) - nbDispo(a.p) || a.i - b.i)
    .map(({ p }) => p);
  const choisis = profils.filter((p) => selection.has(p.id));
  const tousCoches = affiches.length > 0 && affiches.every((p) => selection.has(p.id));

  function basculer(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function retirer(ids: string[]) {
    setErreur(null);
    demarrer(async () => {
      const res = await retirerDeLaReserve(ids);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setSelection(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" id="reserve">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          Mets des profils de côté depuis Candidatures (<b>🗄️ Mettre en réserve</b>) ou depuis une journée (<b>🗄️ Mettre
          en réserve</b> sur la sélection). Chacun rappelle où il a postulé et ses dispos.
        </p>
        {profils.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSelection(tousCoches ? new Set() : new Set(affiches.map((p) => p.id)))}
          >
            {tousCoches ? "Tout décocher" : "Tout cocher"} ({affiches.length})
          </Button>
        )}
      </div>

      {datesConnues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par dispo">
          <span className="text-xs font-medium text-text-muted">Classés par dispo · voir ceux dispo le :</span>
          <button
            type="button"
            onClick={() => setDateFiltre(null)}
            aria-pressed={dateFiltre === null}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              dateFiltre === null ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-text"
            )}
          >
            Toutes les dates ({profils.length})
          </button>
          {datesConnues.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDateFiltre(dateFiltre === d ? null : d)}
              aria-pressed={dateFiltre === d}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium tabular-nums",
                dateFiltre === d ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border-strong hover:border-text"
              )}
            >
              ✅ {formatDayMonth(d)} ({dateCompte.get(d)})
            </button>
          ))}
        </div>
      )}

      {choisis.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-xl border border-border-strong bg-ink-raised px-3 py-2.5 shadow">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm">
              {choisis.length} sélectionné{choisis.length > 1 ? "s" : ""}
            </b>
            <Button type="button" variant="secondary" onClick={() => setEnvoi((v) => !v)} aria-expanded={envoi}>
              📋 Envoyer en booking
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => retirer(choisis.map((p) => p.id))}>
              ↩ Retirer de la réserve
            </Button>
          </div>
          {envoi && (
            <AddToJourneeBar
              figurantIds={choisis.map((p) => p.figurantId)}
              candidatureIdByFigurant={Object.fromEntries(
                choisis.filter((p) => p.candidatureId).map((p) => [p.figurantId, p.candidatureId!])
              )}
              projets={[projet]}
              onDone={() => {
                // Envoyés en booking : ils quittent la réserve.
                const ids = choisis.map((p) => p.id);
                setEnvoi(false);
                retirer(ids);
              }}
            />
          )}
        </div>
      )}
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {affiches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          {profils.length === 0 ? "La réserve est vide." : "Personne de dispo ce jour-là dans la réserve."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]">
          {affiches.map((p) => {
            const coche = selection.has(p.id);
            const dispoOui = p.dispos.filter((d) => d.disponible === true);
            const dispoNon = p.dispos.filter((d) => d.disponible === false);
            const longue = p.dispos.length > 10;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border-2 p-2.5 transition-colors",
                  coche ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
                )}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                  {p.portraitUrl ? (
                    <ZoomableImage
                      src={p.portraitUrl}
                      alt={p.nom}
                      sizes="(max-width: 640px) 50vw, 240px"
                      gallery={p.galerie}
                      index={Math.max(0, p.galerie.findIndex((g) => g.src === p.portraitUrl))}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">Pas de photo</span>
                  )}
                  <button
                    type="button"
                    onClick={() => basculer(p.id)}
                    aria-pressed={coche}
                    aria-label={`Sélectionner ${p.nom}`}
                    className={cn(
                      "absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border-2 text-sm font-bold shadow",
                      coche ? "border-coral bg-coral text-ink" : "border-white/80 bg-ink/70 text-transparent hover:text-white/70"
                    )}
                  >
                    ✓
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <b className="leading-tight">{p.nom}</b>
                  <span className="text-xs text-text-muted">
                    {[p.age != null && `${p.age} ans`, p.ville].filter(Boolean).join(" · ") || "—"}
                  </span>
                  {p.annonceTitre ? (
                    <span className="text-xs">
                      📄 A postulé : <b>{p.annonceTitre}</b>
                      {p.postuleLe && <span className="text-text-muted"> · le {formatDateShort(p.postuleLe.slice(0, 10))}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Pas de candidature (ajouté directement).</span>
                  )}
                  {p.dispos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium tabular-nums">
                      {longue ? (
                        <>
                          <span className="text-turquoise">✅ {dispoOui.length} jour{dispoOui.length > 1 ? "s" : ""} dispo</span>
                          <span className="text-danger">🚫 {dispoNon.length} pas dispo</span>
                        </>
                      ) : (
                        p.dispos.map((d) => (
                          <span
                            key={d.date}
                            className={cn(
                              "rounded-md border px-1.5 py-0.5",
                              d.disponible === true && "border-turquoise/60 text-turquoise",
                              d.disponible === false && "border-dashed border-border-strong text-text line-through",
                              d.disponible === null && "border-border text-text-muted"
                            )}
                            title={d.disponible === true ? "Dispo" : d.disponible === false ? "Pas dispo" : "Pas de réponse"}
                          >
                            {d.disponible === true ? "✅" : d.disponible === false ? "🚫" : "·"} {formatDayMonth(d.date)}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                  <span className="text-[11px] text-text-muted">En réserve depuis le {formatDateShort(p.miseLe.slice(0, 10))}</span>
                  {p.candidatureId && (
                    <Link href={`/candidatures/${p.candidatureId}`} className="text-xs font-medium text-coral hover:underline">
                      📄 Voir sa candidature
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
