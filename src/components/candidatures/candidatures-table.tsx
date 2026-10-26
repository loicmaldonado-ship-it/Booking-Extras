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
import { JoursPanneau, type JourPanneau } from "@/components/candidatures/jours-panneau";
import { MessageCandidatures } from "@/components/candidatures/message-candidatures";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { AddToCastingBar } from "@/components/casting/add-to-casting-bar";
import { Button } from "@/components/ui/button";
import { Modale } from "@/components/ui/modale";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import type { PhotoType } from "@/lib/figurants/types";
import { setCandidatureOnglet, setCandidaturesOngletBulk } from "@/lib/candidatures/actions";
import { RangementCarte } from "@/components/candidatures/rangement-carte";
import { creerEtiquette, setEtiquettesBulk, type Etiquette } from "@/lib/candidatures/etiquettes";
import { mettreCandidaturesEnReserve } from "@/lib/reserve/actions";
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
};

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
  annonceId,
  etiquettes,
  etiquettesParCandidature,
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
  annonceId: string;
  etiquettes: Etiquette[];
  // Étiquettes posées, par candidature.
  etiquettesParCandidature: Record<string, string[]>;
  pagination?: ReactNode;
}) {
  const router = useRouter();
  const [bulkPending, startBulk] = useTransition();
  const [, startRanger] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [messagesOuverts, setMessagesOuverts] = useState<Set<string>>(new Set());
  const [outil, setOutil] = useState<"envoi" | "casting" | "journee" | "etiquettes" | "reserve" | null>(null);
  // Profils cochés au moment d'ouvrir une fenêtre d'action : elle les garde
  // même une fois la sélection vidée par l'envoi, pour afficher le résultat.
  const [figee, setFigee] = useState<Row[]>([]);
  const [reserveInfo, setReserveInfo] = useState<{ ok: boolean; texte: string } | null>(null);
  const [nouvelleEtiquette, setNouvelleEtiquette] = useState("");
  const [etiquetteInfo, setEtiquetteInfo] = useState<{ ok: boolean; texte: string } | null>(null);
  const [triOpen, setTriOpen] = useState(false);
  const [triStart, setTriStart] = useState<string | null>(null);
  const [ecrireA, setEcrireA] = useState<Row[] | null>(null);
  // Cartes retournées au clic (message visible sans survol : iPad, téléphone).
  const [retournes, setRetournes] = useState<Set<string>>(new Set());

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
  function ouvrir(o: NonNullable<typeof outil>) {
    setFigee(selection);
    setEtiquetteInfo(null);
    setReserveInfo(null);
    setOutil(o);
  }

  function rangerUn(r: Row, ongletId: string) {
    if (enCours.has(r.id)) return;
    const cible = r.onglet_id === ongletId ? null : ongletId;
    setErreur(null);
    setEnCours((prev) => new Set(prev).add(r.id));
    startRanger(async () => {
      try {
        const res = await setCandidatureOnglet(r.id, cible);
        if (res?.error) {
          setErreur(`${nomComplet(r.figurants)} : ${res.error}`);
          return;
        }
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(r.id);
          return next;
        });
        router.refresh();
      } catch {
        setErreur("Rangement impossible pour le moment. Réessaie.");
      } finally {
        setEnCours((prev) => {
          const next = new Set(prev);
          next.delete(r.id);
          return next;
        });
      }
    });
  }

  function rangerSelection(ongletId: string | null) {
    if (bulkPending || selected.size === 0) return;
    const ids = Array.from(selected);
    setErreur(null);
    startBulk(async () => {
      try {
        const res = await setCandidaturesOngletBulk(ids, ongletId);
        if (res && "error" in res && res.error) {
          setErreur(res.error);
          return;
        }
        setSelected(new Set());
        router.refresh();
      } catch {
        setErreur("Rangement impossible pour le moment. Réessaie.");
      }
    });
  }

  // Pose ou retire une étiquette sur toute la sélection, sans la déplacer.
  // Met la sélection de côté (réserve du projet, sur la page Bookings).
  function mettreEnReserve() {
    const ids = figee.map((r) => r.id);
    setReserveInfo(null);
    startBulk(async () => {
      const res = await mettreCandidaturesEnReserve(ids);
      if (res.error) {
        setReserveInfo({ ok: false, texte: res.error });
        return;
      }
      setReserveInfo({ ok: true, texte: `✓ ${res.n} profil${(res.n ?? 0) > 1 ? "s" : ""} en réserve.` });
      setSelected(new Set());
      router.refresh();
    });
  }

  function etiqueter(e: Etiquette, pose: boolean) {
    const ids = figee.map((r) => r.id);
    setEtiquetteInfo(null);
    startBulk(async () => {
      const res = await setEtiquettesBulk(ids, e.id, pose);
      if (res.error) setEtiquetteInfo({ ok: false, texte: res.error });
      else {
        setEtiquetteInfo({
          ok: true,
          texte: `✓ « ${e.nom} » ${pose ? "posée sur" : "retirée de"} ${res.n} profil${(res.n ?? 0) > 1 ? "s" : ""}.`,
        });
        router.refresh();
      }
    });
  }

  function etiquetterNouvelle() {
    const nom = nouvelleEtiquette.trim();
    if (!nom) return;
    setEtiquetteInfo(null);
    startBulk(async () => {
      const cree = await creerEtiquette(annonceId, nom);
      if (cree.error || !cree.etiquette) {
        setEtiquetteInfo({ ok: false, texte: cree.error ?? "Création impossible." });
        return;
      }
      const res = await setEtiquettesBulk(figee.map((r) => r.id), cree.etiquette.id, true);
      if (res.error) setEtiquetteInfo({ ok: false, texte: res.error });
      else {
        setNouvelleEtiquette("");
        setEtiquetteInfo({
          ok: true,
          texte: `✓ « ${cree.etiquette.nom} » posée sur ${res.n} profil${(res.n ?? 0) > 1 ? "s" : ""}.`,
        });
        router.refresh();
      }
    });
  }

  function apresEnvoi() {
    // La fenêtre reste ouverte : la confirmation reste lisible, on la ferme à la main.
    setSelected(new Set());
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
      selection={figee.map((r) => ({ id: r.id, nom: nomComplet(r.figurants), jours: summaries[r.id]?.jours ?? [] }))}
      onEnvoye={apresEnvoi}
    />
  );

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      {projetId && <FonctionsDatalist id={`fonctions-projet-${projetId}`} projetId={projetId} />}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                Coche des profils pour les ranger, les étiqueter ou les envoyer en booking, ou change la place d&apos;un
                profil depuis sa carte (📍).
              </span>
            )}
            <span className="flex-1" />
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
              <a
                href={`/candidatures/documents/trombis?annonce_id=${encodeURIComponent(annonceId)}&ids=${selection.map((r) => r.id).join(",")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                🖼️ Trombi ({selection.length})
              </a>
              <a
                href={`/candidatures/documents/fiches?annonce_id=${encodeURIComponent(annonceId)}&ids=${selection.map((r) => r.id).join(",")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                📏 Fiches mensuration ({selection.length})
              </a>
              {jours.length > 0 && (
                <button
                  type="button"
                  onClick={() => ouvrir("envoi")}
                  className="rounded-full border-2 border-turquoise px-3 py-1.5 text-xs font-semibold text-turquoise hover:bg-turquoise/10"
                >
                  📋 Envoyer en booking ({selection.length})
                </button>
              )}
              {(
                [
                  ["etiquettes", `🏷️ Étiqueter (${selection.length})`],
                  ["reserve", `🗄️ Mettre en réserve (${selection.length})`],
                ] as const
              ).map(([o, label]) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => ouvrir(o)}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEcrireA(selection)}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                💬 Message ({selection.length})
              </button>
              <button
                type="button"
                onClick={() => ouvrir("casting")}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                🎭 Ajouter au casting
              </button>
              <button
                type="button"
                onClick={() => ouvrir("journee")}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              >
                📋 Envoyer en booking sur une autre date
              </button>
            </div>
          )}
        </div>

        {outil === "reserve" && (
          <Modale titre="🗄️ Mettre en réserve" sousTitre={`${figee.length} profil${figee.length > 1 ? "s" : ""}`} onClose={() => setOutil(null)} bloquee={bulkPending}>
            {reserveInfo?.ok ? (
              <>
                <p className="text-sm font-medium text-turquoise">{reserveInfo.texte}</p>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setOutil(null)}>
                    Fermer
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-text-muted">
                  Ils quittent cette liste et rejoignent la <b>Réserve</b> du projet (bouton <b>🗄️ Réserve</b> de la page
                  Bookings), avec l&apos;annonce où ils ont postulé et leurs dispos, pour les recontacter plus tard.
                </p>
                {reserveInfo && <p className="text-sm text-danger">{reserveInfo.texte}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOutil(null)}>
                    Annuler
                  </Button>
                  <Button type="button" disabled={bulkPending} onClick={mettreEnReserve}>
                    {bulkPending ? "…" : "Confirmer la mise en réserve"}
                  </Button>
                </div>
              </>
            )}
          </Modale>
        )}

        {outil === "etiquettes" && (
          <Modale titre="🏷️ Étiqueter" sousTitre={`${figee.length} profil${figee.length > 1 ? "s" : ""}` + " (sans les déplacer)"} onClose={() => setOutil(null)} bloquee={bulkPending}>
            {etiquettes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {etiquettes.map((e) => (
                  <span key={e.id} className="flex items-center overflow-hidden rounded-full border border-border-strong text-sm font-medium">
                    <span className="px-3 py-1.5">{e.nom}</span>
                    <button
                      type="button"
                      disabled={bulkPending}
                      onClick={() => etiqueter(e, true)}
                      className="border-l border-border-strong px-2.5 py-1.5 text-turquoise hover:bg-turquoise/10 disabled:opacity-50"
                      title={`Poser « ${e.nom} » sur la sélection`}
                    >
                      ＋ Poser
                    </button>
                    <button
                      type="button"
                      disabled={bulkPending}
                      onClick={() => etiqueter(e, false)}
                      className="border-l border-border-strong px-2.5 py-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                      title={`Retirer « ${e.nom} » de la sélection`}
                    >
                      − Retirer
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={nouvelleEtiquette}
                onChange={(e) => setNouvelleEtiquette(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    etiquetterNouvelle();
                  }
                }}
                placeholder="Nouvelle étiquette (ex. Vélo)"
                maxLength={40}
                className="min-w-0 flex-1 rounded-lg border border-border-strong bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <Button type="button" variant="secondary" disabled={bulkPending || !nouvelleEtiquette.trim()} onClick={etiquetterNouvelle}>
                Créer et poser
              </Button>
            </div>
            {etiquetteInfo && (
              <p className={cn("text-sm", etiquetteInfo.ok ? "font-medium text-turquoise" : "text-danger")}>{etiquetteInfo.texte}</p>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOutil(null)}>
                Terminé
              </Button>
            </div>
          </Modale>
        )}

        {outil === "envoi" && panneau && (
          <Modale titre="📋 Envoyer en booking" sousTitre={`${figee.length} profil${figee.length > 1 ? "s" : ""}`} onClose={() => setOutil(null)} large>
            <div className="grid gap-3 md:grid-cols-2 [&>div]:contents [&>div>p]:col-span-full">{panneau}</div>
          </Modale>
        )}

        {outil === "casting" && (
          <Modale titre="🎭 Ajouter au casting" sousTitre={`${figee.length} profil${figee.length > 1 ? "s" : ""}`} onClose={() => setOutil(null)}>
            <AddToCastingBar figurantIds={Array.from(new Set(figee.map((r) => r.figurants!.id)))} projets={projets} onDone={apresEnvoi} />
          </Modale>
        )}

        {outil === "journee" && (
          <Modale titre="📋 Envoyer en booking sur une autre date" sousTitre={`${figee.length} profil${figee.length > 1 ? "s" : ""}`} onClose={() => setOutil(null)}>
            <AddToJourneeBar
              fonctionFacultative
              figurantIds={Array.from(new Set(figee.map((r) => r.figurants!.id)))}
              candidatureIdByFigurant={Object.fromEntries(figee.map((r) => [r.figurants!.id, r.id]))}
              candidatureProjectByFigurant={Object.fromEntries(
                figee.map((r) => [r.figurants!.id, r.annonces?.projet_id ?? ""])
              )}
              projets={projets}
              onDone={apresEnvoi}
            />
          </Modale>
        )}

        {erreur && (
          <Modale titre="Action impossible" onClose={() => setErreur(null)}>
            <p className="text-sm text-danger">{erreur}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setErreur(null)}>
                Fermer
              </Button>
            </div>
          </Modale>
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
                  </div>
                  <RangementCarte
                    candidatureId={r.id}
                    annonceId={annonceId}
                    ongletId={r.onglet_id}
                    onglets={onglets}
                    etiquettes={etiquettes}
                    poses={etiquettesParCandidature[r.id] ?? []}
                  />
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
                  <th className="px-3 py-2.5 font-medium">Place · étiquettes · jours</th>
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
                      <td className="min-w-[11rem] px-3 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          <RangementCarte
                            candidatureId={r.id}
                            annonceId={annonceId}
                            ongletId={r.onglet_id}
                            onglets={onglets}
                            etiquettes={etiquettes}
                            poses={etiquettesParCandidature[r.id] ?? []}
                          />
                          <JourChips candidatureId={r.id} jours={s?.jours ?? []} />
                        </div>
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

      {ecrireA && ecrireA.length > 0 && (
        <MessageCandidatures destinataires={ecrireA} onClose={() => setEcrireA(null)} />
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
