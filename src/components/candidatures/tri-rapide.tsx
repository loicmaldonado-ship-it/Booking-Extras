"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { getCandidatureTriData, setCandidatureOnglet } from "@/lib/candidatures/actions";
import type { CandidatureOnglet, TriCandidature } from "@/lib/candidatures/types";
import { PHOTO_TYPE_LABELS } from "@/lib/figurants/photo-labels";
import type { PhotoType } from "@/lib/figurants/types";
import { formatDateShort } from "@/lib/format-date";
import { TONE_CLASSES } from "@/components/candidatures/onglet-picker";
import { HabitueBadge } from "@/components/candidatures/habitue-badge";
import { JourChipsView, JOUR_KEYS } from "@/components/candidatures/jour-chips";
import { setCandidatureJour } from "@/lib/candidatures/jours";

type Option = { id: string | null; nom: string; couleur: CandidatureOnglet["couleur"]; key: string };

// Un·e candidat·e à la fois, tout visible sans survol (tablette/téléphone
// compris), rangement en un clic ou une touche, puis passage automatique au
// suivant. Les données sont chargées une par une (+ la suivante en avance)
// plutôt que toute la liste d'un coup : photos signées et réponses pour des
// centaines de profils coûteraient cher en egress pour rien.
export function TriRapide({
  ids: initialIds,
  startId,
  onglets,
  onClose,
}: {
  ids: string[];
  // Ouvert depuis le nom d'une personne : on démarre sur elle, les flèches
  // parcourent ensuite le reste de la liste affichée.
  startId?: string;
  onglets: CandidatureOnglet[];
  onClose: () => void;
}) {
  // Liste figée à l'ouverture : chaque rangement revalide la page, et la
  // personne rangée quitte par exemple "À trier" — sans ce gel, la liste se
  // décalerait sous nos pieds et le tri sauterait quelqu'un.
  const [ids] = useState(initialIds);
  const [index, setIndex] = useState(() => Math.max(0, startId ? initialIds.indexOf(startId) : 0));
  const [cache, setCache] = useState<Record<string, TriCandidature | { error: string }>>({});
  const [ongletOverride, setOngletOverride] = useState<Record<string, string | null>>({});
  const [rangesIds, setRangesIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Jours prévus modifiés pendant ce tri, par candidature puis par date.
  const [jourOverride, setJourOverride] = useState<Record<string, Record<string, boolean>>>({});
  const requested = useRef(new Set<string>());

  // 0 = "À trier", puis 1..9 dans l'ordre des onglets (OUT BE toujours dernier).
  const options: Option[] = [
    { id: null, nom: "À trier", couleur: "default", key: "0" },
    ...onglets.slice(0, 9).map((o, i) => ({ id: o.id, nom: o.nom, couleur: o.couleur, key: String(i + 1) })),
  ];

  const load = useCallback((id: string | undefined) => {
    if (!id || requested.current.has(id)) return;
    requested.current.add(id);
    getCandidatureTriData(id).then((res) => {
      setCache((prev) => ({ ...prev, [id]: res.data ?? { error: res.error ?? "Erreur de chargement." } }));
    });
  }, []);

  useEffect(() => {
    load(ids[index]);
    load(ids[index + 1]);
  }, [ids, index, load]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(ids.length, next)));
      setPhotoIndex(0);
    },
    [ids.length]
  );

  const currentId = ids[index];
  const current = currentId ? cache[currentId] : undefined;
  const data = current && !("error" in current) ? current : null;
  const jours = useMemo(
    () => (data ? data.jours.map((j) => ({ ...j, prevu: jourOverride[data.id]?.[j.id] ?? j.prevu })) : []),
    [data, jourOverride]
  );

  const toggleJour = useCallback(
    (jourId: string) => {
      if (!data) return;
      const j = jours.find((x) => x.id === jourId);
      if (!j || j.dansLaJournee) return;
      const id = data.id;
      const prevu = !j.prevu;
      setError(null);
      setJourOverride((prev) => ({ ...prev, [id]: { ...prev[id], [jourId]: prevu } }));
      setCandidatureJour(id, jourId, prevu).then((res) => {
        if (res.error) {
          setJourOverride((prev) => ({ ...prev, [id]: { ...prev[id], [jourId]: !prevu } }));
          setError(`${data.figurant.prenom} ${data.figurant.nom} : ${res.error}`);
        }
      });
    },
    [data, jours]
  );

  const ongletActuel = currentId
    ? currentId in ongletOverride
      ? ongletOverride[currentId]
      : (data?.onglet_id ?? null)
    : null;

  // Optimiste : on passe au suivant tout de suite, l'enregistrement suit ;
  // en cas d'échec on revient sur la personne et on le signale.
  const assign = useCallback(
    (ongletId: string | null) => {
      if (!currentId || !data) return;
      const id = currentId;
      const at = index;
      const previous = ongletActuel;
      setError(null);
      setOngletOverride((prev) => ({ ...prev, [id]: ongletId }));
      setRangesIds((prev) => new Set(prev).add(id));
      goTo(at + 1);
      setCandidatureOnglet(id, ongletId).then((res) => {
        if (res?.error) {
          setOngletOverride((prev) => ({ ...prev, [id]: previous }));
          setRangesIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setError(`${data.figurant.prenom} ${data.figurant.nom} n'a pas été rangé·e : ${res.error}`);
          goTo(at);
        }
      });
    },
    [currentId, data, index, ongletActuel, goTo]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo(index + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(index - 1);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = data?.photos.length ?? 0;
        if (n > 0) setPhotoIndex((p) => (p + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        return;
      }
      // Touche physique plutôt que caractère : sur un clavier français,
      // la rangée des chiffres donne "&", "é"... sans Maj.
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1] ?? (/^\d$/.test(e.key) ? e.key : null);
      const option = digit !== null ? options.find((o) => o.key === digit) : undefined;
      if (option) {
        e.preventDefault();
        assign(option.id);
        return;
      }
      const jourIndex = JOUR_KEYS.indexOf(e.key.toLowerCase());
      if (jourIndex !== -1 && jours[jourIndex]) {
        e.preventDefault();
        toggleJour(jours[jourIndex].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const popup = !!startId;
  const fini = index >= ids.length;
  const ranges = rangesIds.size;
  const photo = data?.photos[photoIndex] ?? data?.photos[0];

  return (
    // Depuis le nom d'une personne : fenêtre pop-up par-dessus la liste (un
    // clic à côté la ferme) ; depuis le bouton "Tri rapide" : plein écran.
    <div
      className={
        popup
          ? "fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6"
          : "fixed inset-0 z-50"
      }
      onMouseDown={popup ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div
        className={cn(
          "flex flex-col bg-ink",
          popup ? "max-h-full w-full max-w-5xl overflow-hidden rounded-2xl border border-border shadow-2xl" : "h-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={popup ? "Candidature" : "Tri rapide"}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">{startId ? "Candidatures" : "⚡ Tri rapide"}</span>
          <span className="text-sm tabular-nums text-text-muted">
            {Math.min(index + 1, ids.length)} / {ids.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-raised-2">
            <div className="h-full bg-coral transition-all" style={{ width: `${(Math.min(index, ids.length) / ids.length) * 100}%` }} />
          </div>
          <span className="hidden text-xs text-text-muted sm:inline">{ranges} rangé·e{ranges > 1 ? "s" : ""}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-ink-raised-2 hover:text-text"
            aria-label="Fermer le tri rapide"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</div>
        )}

        {fini ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-2xl font-semibold">C&apos;est tout pour cette liste</p>
            <p className="text-text-muted">
              {ranges} profil{ranges > 1 ? "s" : ""} rangé{ranges > 1 ? "s" : ""} pendant ce tri.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goTo(0)}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-coral/60"
              >
                Recommencer depuis le début
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-ink hover:bg-coral-hover"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {!current ? (
                <p className="p-10 text-center text-text-muted">Chargement…</p>
              ) : "error" in current ? (
                <p className="p-10 text-center text-danger">{current.error}</p>
              ) : (
                <div className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-6">
                  <div className="flex flex-col gap-3">
                    <div
                      className={cn(
                        "relative h-[34vh] overflow-hidden rounded-2xl bg-ink-raised-2",
                        popup ? "md:h-[48vh]" : "md:h-[62vh]"
                      )}
                    >
                      {photo ? (
                        <Image
                          key={photo.url}
                          src={photo.url}
                          alt={PHOTO_TYPE_LABELS[photo.type as PhotoType] ?? photo.type}
                          fill
                          sizes="(max-width: 768px) 100vw, 55vw"
                          className="object-contain"
                          priority
                        />
                      ) : (
                        <p className="flex h-full items-center justify-center text-sm text-text-muted">Pas de photo</p>
                      )}
                    </div>
                    {data!.photos.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {data!.photos.map((p, i) => (
                          <button
                            key={p.url}
                            type="button"
                            onClick={() => setPhotoIndex(i)}
                            className={cn(
                              "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2",
                              i === photoIndex ? "border-coral" : "border-transparent opacity-70 hover:opacity-100"
                            )}
                            aria-label={PHOTO_TYPE_LABELS[p.type as PhotoType] ?? p.type}
                          >
                            <Image src={p.url} alt="" fill sizes="64px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-3xl font-semibold">
                        {data!.figurant.prenom} {data!.figurant.nom}
                      </h2>
                      <p className="mt-1 text-text-muted">
                        {[
                          data!.figurant.age != null && `${data!.figurant.age} ans`,
                          data!.figurant.genre,
                          [data!.figurant.ville, data!.figurant.code_postal].filter(Boolean).join(" "),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <HabitueBadge tournages={data!.tournagesConfirmes} className="text-xs" />
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            data!.figurant.compte_myrole ? "bg-turquoise/15 text-turquoise" : "bg-ink-raised-2 text-text-muted"
                          )}
                        >
                          {data!.figurant.compte_myrole ? "Compte Myrole" : "Pas de compte Myrole"}
                        </span>
                        {data!.figurant.vehicule && (
                          <span className="rounded-full bg-ink-raised-2 px-2 py-0.5 text-xs text-text-muted">
                            Véhicule : {data!.figurant.vehicule}
                          </span>
                        )}
                      </div>
                    </div>

                    {jours.length > 0 && (
                      <div>
                        <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                          Jours de tournage
                        </h3>
                        <JourChipsView jours={jours} onToggle={(j) => toggleJour(j.id)} size="lg" showKeys />
                        <p className="mt-1.5 text-[11px] text-text-muted">
                          Contour vert = dispo, plein = prévu·e ce jour, ✓ = déjà dans la journée.
                        </p>
                      </div>
                    )}

                    <div>
                      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">Mensurations</h3>
                      <p className="text-sm tabular-nums">
                        {[
                          data!.figurant.taille_cm && `${data!.figurant.taille_cm} cm`,
                          data!.figurant.poids_kg && `${data!.figurant.poids_kg} kg`,
                          data!.figurant.pointure && `pointure ${data!.figurant.pointure}`,
                          data!.figurant.veste && `veste ${data!.figurant.veste}`,
                          data!.figurant.pantalon && `pantalon ${data!.figurant.pantalon}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>

                    {data!.questions.length > 0 && (
                      <div>
                        <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">Questions</h3>
                        <ul className="flex flex-col gap-1 text-sm">
                          {data!.questions.map((q) => (
                            <li key={q.label} className="flex justify-between gap-3">
                              <span className="text-text-muted">{q.label}</span>
                              <span className={q.reponse ? "text-turquoise" : "text-danger"}>{q.reponse ? "Oui" : "Non"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data!.message && (
                      <div>
                        <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">Message</h3>
                        <p className="whitespace-pre-wrap text-sm">{data!.message}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {data!.lienBandeDemo && (
                        <a href={data!.lienBandeDemo} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                          Bande démo ↗
                        </a>
                      )}
                      <a href={`/candidatures/${data!.id}`} target="_blank" rel="noreferrer" className="text-text-muted hover:text-coral">
                        Fiche complète ↗
                      </a>
                      <span className="text-text-muted">Reçue le {formatDateShort(data!.created_at)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-ink-raised px-4 py-3">
              <div className="mx-auto flex max-w-6xl flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => {
                    const active = ongletActuel === o.id;
                    return (
                      <button
                        key={o.id ?? "a_trier"}
                        type="button"
                        disabled={!data}
                        onClick={() => assign(o.id)}
                        className={cn(
                          "flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-40 sm:flex-none",
                          o.couleur === "default" ? "border-border text-text hover:border-coral/60" : TONE_CLASSES[o.couleur],
                          active && "ring-2 ring-coral ring-offset-2 ring-offset-ink-raised"
                        )}
                      >
                        <kbd className="hidden rounded border border-current/40 px-1.5 text-[10px] font-medium opacity-70 sm:inline">
                          {o.key}
                        </kbd>
                        {o.nom}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => goTo(index - 1)}
                    disabled={index === 0}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-text-muted hover:text-text disabled:opacity-40"
                  >
                    <ChevronLeft size={16} /> Précédent
                  </button>
                  <span className="hidden text-xs text-text-muted md:inline">
                    Touches : 0–{options.length - 1} ranger
                    {jours.length > 0 && ` · ${JOUR_KEYS.slice(0, jours.length).join(" ").toUpperCase()} jours`} · ← →
                    naviguer · ↑ ↓ photos · Échap fermer
                  </span>
                  <button
                    type="button"
                    onClick={() => goTo(index + 1)}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-text-muted hover:text-text"
                  >
                    Passer <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
