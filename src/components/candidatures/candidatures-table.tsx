"use client";

import { nomComplet } from "@/lib/noms";
import { useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { FonctionsDatalist } from "@/components/projets/fonctions-datalist";
import { TONE_CLASSES } from "@/components/candidatures/onglet-picker";
import { HabitueBadge } from "@/components/candidatures/habitue-badge";
import { JourChips, type JourCandidature } from "@/components/candidatures/jour-chips";
import { TriRapide } from "@/components/candidatures/tri-rapide";
import { JoursPanneau, JourneeEnGrand, type JourPanneau } from "@/components/candidatures/jours-panneau";
import { MessageCandidatures } from "@/components/candidatures/message-candidatures";
import { LiensValidation } from "@/components/validation/liens-validation";
import type { LienResume } from "@/lib/validation/data";
import type { MessageTemplate } from "@/lib/templates/types";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { AddToCastingBar } from "@/components/casting/add-to-casting-bar";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import type { PhotoType } from "@/lib/figurants/types";
import { setCandidatureOnglet, setCandidaturesOngletBulk } from "@/lib/candidatures/actions";
import { emojiOnglet, ongletsRapides, sansAccent } from "@/lib/candidatures/onglets-affichage";
import type { Cachet, CandidatureOnglet } from "@/lib/candidatures/types";

export type Row = {
  id: string;
  onglet_id: string | null;
  fonction_assignee: string | null;
  cachet_assigne: Cachet | null;
  figurants: { id: string; prenom: string; nom: string; ville: string | null; email: string | null; telephone: string | null; compte_myrole: boolean } | null;
  annonces: {
    titre: string;
    projet_id: string;
    projets: { nom: string; confidentiel: boolean; nom_code: string | null; lieu: string | null; signature: string | null } | null;
  } | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
};

export type CandidatureSummary = {
  questions: { label: string; reponse: boolean }[];
  message: string | null;
  age: number | null;
  tournages: number;
  jours: JourCandidature[];
  // Dernier avis de la MES sur un lien de validation.
  mes?: { vote: "oui" | "peut" | "non" | null; qui: string; note: string } | null;
};

function BadgeMes({ mes }: { mes: CandidatureSummary["mes"] }) {
  if (!mes) return null;
  const libelle = mes.vote === "oui" ? "Validé MES" : mes.vote === "peut" ? "Peut-être MES" : mes.vote === "non" ? "Écarté MES" : "Note MES";
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "self-start rounded-full px-2 py-0.5 text-[11px] font-semibold",
          mes.vote === "oui"
            ? "bg-turquoise text-white"
            : mes.vote === "peut"
              ? "bg-yellow/25 text-yellow"
              : mes.vote === "non"
                ? "bg-danger/15 text-danger"
                : "bg-ink-raised-2 text-text"
        )}
        title={`Avis de ${mes.qui}`}
      >
        🎬 {libelle} · {mes.qui}
      </span>
      {mes.note && <span className="text-[11px] italic text-text-muted">« {mes.note} »</span>}
    </div>
  );
}

// Met en évidence le texte cherché (sans tenir compte des accents).
function Surligne({ texte, q }: { texte: string; q: string }) {
  if (!q) return <>{texte}</>;
  const i = sansAccent(texte).indexOf(sansAccent(q));
  if (i < 0) return <>{texte}</>;
  return (
    <>
      {texte.slice(0, i)}
      <mark className="rounded bg-yellow/30 px-0.5 text-text">{texte.slice(i, i + q.length)}</mark>
      {texte.slice(i + q.length)}
    </>
  );
}

// Message de candidature : 3 lignes, « Lire tout » pour le reste.
function MessageCandidature({ message, ouvert, onToggle }: { message: string | null; ouvert: boolean; onToggle: () => void }) {
  if (!message?.trim()) return <p className="text-xs italic text-text-muted">Pas de message</p>;
  const long = message.length > 110 || message.split("\n").length > 3;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!long}
      aria-expanded={long ? ouvert : undefined}
      className="w-full rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-left text-sm leading-snug text-text enabled:hover:border-coral/60"
    >
      <span className={cn("whitespace-pre-line", !ouvert && "line-clamp-3")}>💬 {message.trim()}</span>
      {long && <span className="mt-0.5 block font-medium text-coral">{ouvert ? "Réduire" : "Lire tout"}</span>}
    </button>
  );
}

function Reponses({ questions }: { questions: CandidatureSummary["questions"] }) {
  if (questions.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
      {questions.map((q, i) => (
        <span key={i}>
          {q.label} <b className={q.reponse ? "text-turquoise" : "text-danger"}>{q.reponse ? "oui" : "non"}</b>
        </span>
      ))}
    </p>
  );
}

export function CandidaturesTable({
  rows,
  summaries = {},
  onglets,
  projetId,
  projets,
  triIds,
  vue,
  recherche,
  jours,
  templates,
  liens,
  liensOuverts = false,
  origin,
  nomLienParDefaut,
  annonceId,
  pagination,
}: {
  rows: Row[];
  summaries?: Record<string, CandidatureSummary>;
  onglets: CandidatureOnglet[];
  projetId: string | null;
  projets: { id: string; nom: string }[];
  // Toute la liste filtrée/triée (toutes pages), pour le tri rapide.
  triIds: string[];
  vue: "trombi" | "liste";
  recherche: string;
  jours: JourPanneau[];
  templates: MessageTemplate[];
  liens: LienResume[];
  liensOuverts?: boolean;
  origin: string;
  nomLienParDefaut: string;
  annonceId: string;
  pagination?: ReactNode;
}) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  const [, startRanger] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [messagesOuverts, setMessagesOuverts] = useState<Set<string>>(new Set());
  const [outil, setOutil] = useState<"envoi" | "casting" | "journee" | "lien" | null>(liensOuverts ? "lien" : null);
  const [panneauMobile, setPanneauMobile] = useState(false);
  const [triOpen, setTriOpen] = useState(false);
  const [triStart, setTriStart] = useState<string | null>(null);
  const [ecrireA, setEcrireA] = useState<Row[] | null>(null);
  // Cartes retournées au clic (message visible sans survol : iPad, téléphone).
  const [retournes, setRetournes] = useState<Set<string>>(new Set());
  // Jour ouvert en grand : sur téléphone, le tiroir se referme pour le montrer.
  const jourVu = jours.find((j) => j.vu) ?? null;
  const [jourVuSync, setJourVuSync] = useState(jourVu?.id ?? null);
  if ((jourVu?.id ?? null) !== jourVuSync) {
    setJourVuSync(jourVu?.id ?? null);
    if (jourVu) setPanneauMobile(false);
  }

  const rapides = ongletsRapides(onglets);
  const selectableIds = rows.filter((r) => r.figurants?.id).map((r) => r.id);
  const tousCoches = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selection = rows.filter((r) => selected.has(r.id) && r.figurants?.id);

  // Un clic sur le nom ou la photo ouvre la candidature complète en
  // fenêtre (même vue que le tri rapide, démarrée sur cette personne).
  // Cmd/Ctrl-clic ou clic molette ouvrent la page détaillée à part.
  function openFiche(e: React.MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setTriStart(id);
    setTriOpen(true);
  }

  const previewItems: PreviewItem[] = rows
    .filter((r): r is Row & { figurants: NonNullable<Row["figurants"]> } => !!r.figurants)
    .map((r) => ({ id: r.figurants.id, prenom: r.figurants.prenom, nom: r.figurants.nom, ville: r.figurants.ville, portraitUrl: r.portraitUrl }));
  const previewIndex = new Map(rows.filter((r) => r.figurants?.id).map((r, i) => [r.id, i]));

  function bascule<T>(set: Set<T>, v: T) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }

  // Un profil : re-cliquer sur son rangement actuel le renvoie dans « À trier ».
  function rangerUn(r: Row, ongletId: string) {
    const cible = r.onglet_id === ongletId ? null : ongletId;
    setErreur(null);
    setEnCours((prev) => new Set(prev).add(r.id));
    startRanger(async () => {
      const res = await setCandidatureOnglet(r.id, cible);
      if (res?.error) setErreur(`${nomComplet(r.figurants)} : ${res.error}`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
      router.refresh();
      setEnCours((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    });
  }

  function rangerSelection(ongletId: string | null) {
    const ids = Array.from(selected);
    setErreur(null);
    startBulk(async () => {
      const res = await setCandidaturesOngletBulk(ids, ongletId);
      if (res && "error" in res && res.error) setErreur(res.error);
      setSelected(new Set());
      router.refresh();
    });
  }

  function apresEnvoi() {
    setSelected(new Set());
    // L'envoi dans un jour garde sa fenêtre ouverte : la confirmation reste lisible.
    setOutil((o) => (o === "envoi" ? o : null));
    router.refresh();
  }

  function boutonsRanger(r: Row, large = false) {
    const boutons = [
      { onglet: rapides.retenu, emoji: "✅", titre: "Retenir", on: "border-turquoise bg-turquoise/20" },
      { onglet: rapides.peutEtre, emoji: "🤔", titre: "Peut-être", on: "border-yellow bg-yellow/20" },
      { onglet: rapides.out, emoji: "🚫", titre: "OUT (la personne est prévenue dans son espace)", on: "border-danger bg-danger/20" },
    ].filter((b) => b.onglet);
    return (
      <div className={cn("grid gap-1.5", large ? "grid-cols-3" : "w-32 grid-cols-3")}>
        {boutons.map((b) => {
          const actif = r.onglet_id === b.onglet!.id;
          return (
            <button
              key={b.onglet!.id}
              type="button"
              disabled={enCours.has(r.id)}
              onClick={() => rangerUn(r, b.onglet!.id)}
              title={actif ? `${b.titre} — re-cliquer pour remettre dans « À trier »` : b.titre}
              aria-label={b.titre}
              aria-pressed={actif}
              className={cn(
                "rounded-lg border-2 py-1 text-base transition-colors disabled:opacity-40",
                actif ? b.on : "border-border-strong bg-ink hover:border-coral/60"
              )}
            >
              {b.emoji}
            </button>
          );
        })}
      </div>
    );
  }

  const meta = (r: Row) =>
    [summaries[r.id]?.age != null && `${summaries[r.id].age} ans`, r.figurants?.ville].filter(Boolean).join(" · ") || "—";

  const panneau = jours.length > 0 && projetId && (
    <JoursPanneau
      jours={jours}
      projetId={projetId}
      selection={selection.map((r) => ({ id: r.id, nom: nomComplet(r.figurants), jours: summaries[r.id]?.jours ?? [] }))}
      onEnvoye={apresEnvoi}
    />
  );

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      {projetId && <FonctionsDatalist id={`fonctions-projet-${projetId}`} projetId={projetId} />}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {jourVu && projetId && (
          <JourneeEnGrand
            jour={jourVu}
            projetId={projetId}
            fermerHref={jourVu.vuHref}
          />
        )}
        {/* Barre de sélection : ranger plusieurs profils d'un coup. */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {selectableIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected(tousCoches ? new Set() : new Set(selectableIds))}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                {tousCoches ? "Tout décocher" : "Tout cocher"} ({selectableIds.length})
              </button>
            )}
            {selected.size > 0 ? (
              <>
                <b className="text-sm">
                  {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                </b>
                <span className="text-xs text-text-muted">Ranger dans :</span>
                <button
                  type="button"
                  disabled={bulkPending}
                  onClick={() => rangerSelection(null)}
                  className="rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium hover:border-coral/60"
                >
                  📥 À trier
                </button>
                {onglets.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={bulkPending}
                    onClick={() => rangerSelection(o.id)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", TONE_CLASSES[o.couleur])}
                  >
                    {emojiOnglet(o)} {o.nom}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-xs text-text-muted">
                Coche des profils pour les ranger ou les envoyer dans un jour, ou range-les un par un avec les boutons sous
                chaque photo.
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setOutil(outil === "lien" ? null : "lien")}
              aria-expanded={outil === "lien"}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                outil === "lien" ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
              )}
            >
              🔗 Lien de validation MES
              {liens.length > 0 && ` (${liens.length})`}
              {liens.some((l) => l.visites.some((v) => v.enLigne)) && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-turquoise" />}
            </button>
            {triIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTriStart(null);
                  setTriOpen(true);
                }}
                className="rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-ink hover:bg-coral-hover"
              >
                ⚡ Trier un par un ({triIds.length})
              </button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              {jours.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOutil(outil === "envoi" ? null : "envoi")}
                  aria-expanded={outil === "envoi"}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    outil === "envoi" ? "bg-coral/15 text-coral ring-2 ring-coral" : "bg-coral text-ink hover:bg-coral-hover"
                  )}
                >
                  📅 Envoyer dans un jour ({selection.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setEcrireA(selection)}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                💬 Message ({selection.length})
              </button>
              <button
                type="button"
                onClick={() => setOutil(outil === "casting" ? null : "casting")}
                aria-expanded={outil === "casting"}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  outil === "casting" ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
                )}
              >
                🎭 Ajouter au casting
              </button>
              <button
                type="button"
                onClick={() => setOutil(outil === "journee" ? null : "journee")}
                aria-expanded={outil === "journee"}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  outil === "journee" ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
                )}
              >
                📅 Envoyer dans une autre journée
              </button>
              {jours.length > 0 && (
                <span className="text-xs text-text-muted xl:inline">
                  Envoyer en booking : « 📅 Envoyer dans un jour ».
                </span>
              )}
            </div>
          )}
          {outil === "lien" && (
            <LiensValidation cible={{ annonceId }} nomParDefaut={nomLienParDefaut} liens={liens} origin={origin} />
          )}
          {/* Reste ouvert après l'envoi pour montrer la confirmation. */}
          {outil === "envoi" && panneau && (
            <div className="flex flex-col gap-2 rounded-xl border border-coral/40 bg-ink p-3">
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm">📅 Envoyer en booking dans un jour</b>
                <button
                  type="button"
                  onClick={() => setOutil(null)}
                  className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60"
                >
                  Fermer
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>div]:contents [&>div>p]:col-span-full">{panneau}</div>
            </div>
          )}
          {selected.size > 0 && outil === "casting" && (
            <AddToCastingBar figurantIds={selection.map((r) => r.figurants!.id)} projets={projets} onDone={apresEnvoi} />
          )}
          {selected.size > 0 && outil === "journee" && (
            <AddToJourneeBar
              figurantIds={selection.map((r) => r.figurants!.id)}
              candidatureIdByFigurant={Object.fromEntries(selection.map((r) => [r.figurants!.id, r.id]))}
              projets={projets}
              onDone={apresEnvoi}
            />
          )}
        </div>

        {erreur && (
          <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-2 text-sm text-danger">{erreur}</div>
        )}

        {vue === "trombi" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]">
            {rows.map((r) => {
              const s = summaries[r.id];
              const coche = selected.has(r.id);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "relative flex flex-col gap-2 rounded-xl border-2 p-2.5 transition-colors",
                    coche ? "border-coral bg-coral/10" : "border-border bg-ink-raised",
                    enCours.has(r.id) && "opacity-50"
                  )}
                >
                  <button
                    type="button"
                    disabled={!r.figurants?.id}
                    onClick={() => setSelected((prev) => bascule(prev, r.id))}
                    aria-pressed={coche}
                    aria-label={`Sélectionner ${nomComplet(r.figurants)}`}
                    className={cn(
                      "absolute left-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md border-2 text-sm font-bold shadow",
                      coche ? "border-coral bg-coral text-ink" : "border-white/80 bg-ink/70 text-transparent hover:text-white/70"
                    )}
                  >
                    ✓
                  </button>
                  {previewIndex.has(r.id) && (
                    <PreviewButton
                      items={previewItems}
                      index={previewIndex.get(r.id)!}
                      className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-xs hover:bg-ink"
                    />
                  )}
                  {/* La photo se retourne (survol à la souris, ou bouton
                      « 💬 Lire le message » sur iPad / téléphone) : au dos,
                      le message en entier et les réponses aux questions. */}
                  {(() => {
                    const retourne = retournes.has(r.id);
                    const message = s?.message?.trim() ?? "";
                    const aLire = !!message || (s?.questions.length ?? 0) > 0;
                    return (
                      <>
                        <div className="group relative aspect-[4/5] w-full [perspective:1000px]">
                          <div
                            className={cn(
                              "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
                              retourne ? "[transform:rotateY(180deg)]" : "[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]"
                            )}
                          >
                            <Link
                              href={`/candidatures/${r.id}`}
                              onClick={(e) => openFiche(e, r.id)}
                              className="absolute inset-0 overflow-hidden rounded-lg bg-ink-raised-2 [backface-visibility:hidden]"
                            >
                              {r.portraitUrl && (
                                <Image src={r.portraitUrl} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                              )}
                              {message && (
                                <span className="absolute bottom-2 right-2 rounded-full bg-ink/85 px-2 py-1 text-xs font-medium text-text shadow" aria-hidden>
                                  💬 Message
                                </span>
                              )}
                            </Link>
                            <div
                              className={cn(
                                "absolute inset-0 flex flex-col gap-2 overflow-hidden rounded-lg border border-border-strong bg-ink p-3 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]",
                                retourne ? "pointer-events-auto" : "pointer-events-none [@media(hover:hover)]:group-hover:pointer-events-auto"
                              )}
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">💬 Message</p>
                              {message ? (
                                <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line pr-1 text-[15px] leading-relaxed text-text">
                                  {message}
                                </p>
                              ) : (
                                <p className="flex-1 text-sm italic text-text-muted">Pas de message.</p>
                              )}
                              {(s?.questions ?? []).length > 0 && (
                                <div className="flex flex-col gap-0.5 border-t border-border pt-1.5">
                                  {(s?.questions ?? []).map((q, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate text-text-muted">{q.label}</span>
                                      <b className={q.reponse ? "text-turquoise" : "text-danger"}>{q.reponse ? "Oui" : "Non"}</b>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <Link
                                href={`/candidatures/${r.id}`}
                                onClick={(e) => openFiche(e, r.id)}
                                className="text-xs font-medium text-coral hover:underline"
                              >
                                Vue complète →
                              </Link>
                            </div>
                          </div>
                        </div>
                        {aLire && (
                          <button
                            type="button"
                            onClick={() => setRetournes((prev) => bascule(prev, r.id))}
                            aria-pressed={retourne}
                            className={cn(
                              "rounded-lg border px-2 py-1.5 text-xs font-medium",
                              retourne ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
                            )}
                          >
                            {retourne ? "↩ Revoir la photo" : message ? "💬 Lire le message" : "Voir les réponses"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/candidatures/${r.id}`}
                        onClick={(e) => openFiche(e, r.id)}
                        className="text-sm font-semibold leading-tight hover:text-coral"
                      >
                        <Surligne texte={r.figurants ? nomComplet(r.figurants) : "—"} q={recherche} />
                      </Link>
                      {r.figurants && (
                        <button
                          type="button"
                          onClick={() => setEcrireA([r])}
                          title={`Écrire à ${nomComplet(r.figurants)}`}
                          aria-label={`Écrire à ${nomComplet(r.figurants)}`}
                          className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs hover:border-coral/60"
                        >
                          💬
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">{meta(r)}</span>
                    {recherche && r.figurants?.email && (
                      <span className="truncate text-xs text-text-muted">
                        <Surligne texte={r.figurants.email} q={recherche} />
                      </span>
                    )}
                    <HabitueBadge tournages={s?.tournages ?? 0} className="mt-0.5 self-start" />
                    <BadgeMes mes={s?.mes} />
                  </div>
                  <JourChips candidatureId={r.id} jours={s?.jours ?? []} />
                  <div className="mt-auto">
                    {boutonsRanger(r, true)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-ink-raised">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={tousCoches}
                      onChange={() => setSelected(tousCoches ? new Set() : new Set(selectableIds))}
                      aria-label="Tout cocher"
                      className="h-4 w-4 accent-coral"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Nom</th>
                  <th className="px-3 py-2.5 font-medium">Âge · ville</th>
                  <th className="px-3 py-2.5 font-medium">Message</th>
                  <th className="px-3 py-2.5 font-medium">Jours</th>
                  <th className="px-3 py-2.5 font-medium">Réponses</th>
                  <th className="px-3 py-2.5 font-medium">Ranger</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = summaries[r.id];
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-border align-top last:border-0",
                        selected.has(r.id) && "bg-coral/10",
                        enCours.has(r.id) && "opacity-50"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          disabled={!r.figurants?.id}
                          onChange={() => setSelected((prev) => bascule(prev, r.id))}
                          aria-label={`Sélectionner ${nomComplet(r.figurants)}`}
                          className="h-4 w-4 accent-coral"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/candidatures/${r.id}`}
                            onClick={(e) => openFiche(e, r.id)}
                            className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-ink-raised-2"
                          >
                            {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill sizes="40px" className="object-cover" />}
                          </Link>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/candidatures/${r.id}`}
                                onClick={(e) => openFiche(e, r.id)}
                                className="font-semibold hover:text-coral"
                              >
                                <Surligne texte={r.figurants ? nomComplet(r.figurants) : "—"} q={recherche} />
                              </Link>
                              <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} variant="inline" />
                              {r.figurants && (
                                <button
                                  type="button"
                                  onClick={() => setEcrireA([r])}
                                  title={`Écrire à ${nomComplet(r.figurants)}`}
                                  aria-label={`Écrire à ${nomComplet(r.figurants)}`}
                                  className="rounded-full border border-border-strong px-2 py-0.5 text-xs hover:border-coral/60"
                                >
                                  💬
                                </button>
                              )}
                              {previewIndex.has(r.id) && <PreviewButton items={previewItems} index={previewIndex.get(r.id)!} />}
                            </div>
                            {r.figurants?.email && (
                              <div className="truncate text-xs text-text-muted">
                                <Surligne texte={r.figurants.email} q={recherche} />
                              </div>
                            )}
                            <HabitueBadge tournages={s?.tournages ?? 0} className="mt-1 inline-block" />
                            <BadgeMes mes={s?.mes} />
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">{meta(r)}</td>
                      <td className="min-w-[14rem] max-w-[22rem] px-3 py-2.5">
                        <MessageCandidature
                          message={s?.message ?? null}
                          ouvert={messagesOuverts.has(r.id)}
                          onToggle={() => setMessagesOuverts((prev) => bascule(prev, r.id))}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <JourChips candidatureId={r.id} jours={s?.jours ?? []} />
                      </td>
                      <td className="min-w-[8rem] px-3 py-2.5">
                        <Reponses questions={s?.questions ?? []} />
                      </td>
                      <td className="px-3 py-2.5">
                        {boutonsRanger(r)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination}
      </div>

      {panneau && (
        <>
          <aside
            aria-label="Jours de tournage"
            className="hidden w-80 shrink-0 flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-3 xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
          >
            <h2 className="text-base font-semibold">📅 Jours de tournage</h2>
            {panneau}
          </aside>
          {/* Écrans plus étroits : bouton flottant, panneau en tiroir. */}
          <button
            type="button"
            onClick={() => setPanneauMobile(true)}
            className="fixed bottom-5 right-5 z-40 rounded-full bg-coral px-4 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-coral-hover xl:hidden"
          >
            📅 Jours{selected.size > 0 ? ` · ${selected.size} coché${selected.size > 1 ? "s" : ""}` : ""}
          </button>
          {panneauMobile && (
            <div
              className="fixed inset-0 z-[70] flex justify-end bg-ink/60 xl:hidden"
              onMouseDown={(e) => e.target === e.currentTarget && setPanneauMobile(false)}
            >
              <aside
                aria-label="Jours de tournage"
                className="flex h-full w-full max-w-sm flex-col gap-3 overflow-y-auto border-l border-border bg-ink-raised p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">📅 Jours de tournage</h2>
                  <button
                    type="button"
                    onClick={() => setPanneauMobile(false)}
                    className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60"
                  >
                    Fermer
                  </button>
                </div>
                {panneau}
              </aside>
            </div>
          )}
        </>
      )}

      {ecrireA && ecrireA.length > 0 && (
        <MessageCandidatures destinataires={ecrireA} templates={templates} onClose={() => setEcrireA(null)} />
      )}

      {triOpen && (
        <TriRapide
          ids={triIds}
          startId={triStart ?? undefined}
          onglets={onglets}
          onClose={() => {
            setTriOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
