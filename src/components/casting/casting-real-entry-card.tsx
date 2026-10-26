"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/image";
import { Badge } from "@/components/ui/card";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { cn } from "@/lib/cn";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";
import { dateHeure, ts } from "@/lib/i18n/suivi";
import type { ReponseCasting } from "@/lib/casting/types";
import type { Avis } from "@/lib/casting/avis";
import { AccueilVisiteur } from "@/components/partage/visiteur";
import { useReel } from "@/components/casting/reel-context";
import { commenterProfil, commentairesProfil, type CommentaireProfil } from "@/lib/casting/reel";
import { signalerVisitePartage } from "@/lib/partage/suivi";

export type CastingRealEntryItem = {
  id: string;
  nom: string;
  portraitUrl: string | null;
  valide: boolean;
  // Rôle (et sa date) affichés sur le profil dans la section « Profils
  // validés », où les profils de plusieurs rôles se côtoient.
  role: string | null;
  roleDate: string | null;
  videoUrls: { url: string; label: string }[];
  photos: { label: string; url: string }[];
  // Seulement ce que l'équipe a choisi de montrer sur ce lien (filtré côté
  // serveur : une info masquée n'arrive jamais jusqu'ici).
  age: number | null;
  ville: string | null;
  mensurations: { cle: "mens_taille" | "mens_poids" | "mens_pointure" | "mens_veste" | "mens_pantalon"; valeur: string }[];
  reponses: ReponseCasting[];
};

const AVIS: { valeur: Avis; cle: "oui" | "avis_peut_etre" | "non"; symbole: string; actif: string }[] = [
  { valeur: "oui", cle: "oui", symbole: "✓", actif: "border-turquoise bg-turquoise text-ink" },
  { valeur: "peut_etre", cle: "avis_peut_etre", symbole: "?", actif: "border-yellow bg-yellow text-ink" },
  { valeur: "non", cle: "non", symbole: "✕", actif: "border-danger bg-danger text-ink" },
];

const POINT_AVIS: Record<Avis, string> = { oui: "bg-turquoise", peut_etre: "bg-yellow", non: "bg-danger" };

// Mon avis sur un profil : trois cases à cocher (Oui / Peut-être / Non), un
// nouveau toucher sur la case cochée la décoche. Le prénom n'est demandé
// qu'au premier avis.
function AvisProfil({ entryId, lang }: { entryId: string; lang: Lang }) {
  const reel = useReel();
  const [erreur, setErreur] = useState<string | null>(null);
  const [demanderNom, setDemanderNom] = useState(false);
  if (!reel?.avisActifs) return null;
  const courant = reel.mesAvis[entryId] ?? null;
  const sansIdentite = !reel.moi && !reel.apercu;

  async function choisir(avis: Avis) {
    if (!reel) return;
    if (reel.apercu) return;
    if (!reel.moi) {
      setDemanderNom(true);
      return;
    }
    setErreur(null);
    setErreur(await reel.donner(entryId, avis));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">{t(lang, "mon_avis")}</span>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t(lang, "mon_avis")}>
        {AVIS.map((a) => {
          const actif = courant === a.valeur;
          return (
            <button
              key={a.valeur}
              type="button"
              onClick={() => choisir(a.valeur)}
              aria-pressed={actif}
              title={actif ? t(lang, "retirer_avis") : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition-colors",
                actif ? a.actif : "border-border-strong bg-ink hover:border-text"
              )}
            >
              <span className="text-lg leading-none">{a.symbole}</span>
              {t(lang, a.cle)}
            </button>
          );
        })}
      </div>
      {reel.apercu && <p className="text-xs text-text-muted">{t(lang, "apercu_avis")}</p>}
      {sansIdentite && demanderNom && <AccueilVisiteur inline focus lang={lang} />}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  );
}

// Commentaires sur ce profil : le fil de ce profil, et un champ pour écrire.
function CommentairesProfil({ entryId, lang }: { entryId: string; lang: Lang }) {
  const reel = useReel();
  const token = reel?.token;
  const actifs = !!reel?.commentairesActifs;
  const [charge, setCharge] = useState<{ id: string; liste: CommentaireProfil[] } | null>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  const recharger = useCallback(() => {
    if (!token) return;
    commentairesProfil(token, entryId).then((liste) => setCharge({ id: entryId, liste }));
  }, [token, entryId]);

  useEffect(() => {
    if (actifs) recharger();
  }, [actifs, recharger]);

  if (!reel || !actifs) return null;
  const liste = charge?.id === entryId ? charge.liste : [];

  function envoyer() {
    if (!reel?.moi || !texte.trim()) return;
    const moi = reel.moi;
    setErreur(null);
    demarrer(async () => {
      await signalerVisitePartage(reel.token, moi.id, moi.prenom, moi.role);
      const res = await commenterProfil(reel.token, moi.id, entryId, texte);
      if (res.error) setErreur(res.error);
      else {
        setTexte("");
        recharger();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">{t(lang, "commentaires_profil")}</span>
      {liste.length === 0 ? (
        <p className="text-sm text-text-muted">{t(lang, "aucun_commentaire_profil")}</p>
      ) : (
        <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
          {liste.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-ink px-3 py-2 text-sm">
              <span className="block text-[11px] text-text-muted">
                {c.auteur} · {dateHeure(c.created_at, lang)}
              </span>
              <span className="whitespace-pre-wrap">{c.texte}</span>
            </div>
          ))}
        </div>
      )}
      {reel.apercu ? null : !reel.moi ? (
        <AccueilVisiteur inline lang={lang} />
      ) : (
        <div className="flex gap-2">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t(lang, "mot_profil")}
            className="min-w-0 flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={envoyer}
            disabled={pending || !texte.trim()}
            className="self-end rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
          >
            {ts(lang, "envoyer")}
          </button>
        </div>
      )}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  );
}

// Salle de visionnage : une fenêtre pour tout le rôle (précédent / suivant
// sans refermer), la vidéo en grand avec ses essais en onglets, la fiche à
// côté (seulement ce que l'équipe montre), puis mon avis et mes commentaires
// si l'équipe les a activés. Un seul lecteur vidéo monté à la fois : en
// empiler plusieurs a déjà figé l'onglet (2026-09-10).
function CastingRealMediaModal({
  items,
  index,
  roleLabel,
  afficherStatut,
  onIndexChange,
  onClose,
  lang,
}: {
  items: CastingRealEntryItem[];
  index: number;
  roleLabel?: string | null;
  afficherStatut: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const reel = useReel();
  const hasMultiple = items.length > 1;
  const item = items[index] ?? items[0];
  const gallery: GalleryPhoto[] = (item?.photos ?? []).map((p) => ({ src: p.url, alt: p.label }));

  // Essai affiché (le premier à l'ouverture), réinitialisé à chaque changement
  // de profil, pendant le rendu (pas dans un effet). Le profil s'ouvre sans
  // rien lancer ; c'est le bouton « Lancer la vidéo » qui démarre la lecture
  // ET la passe en plein écran (dans ce même clic, seul moment où le
  // navigateur l'autorise). Ensuite les vidéos s'enchaînent : essai suivant,
  // puis profil suivant du rôle qui a une vidéo, sans relancer. Un seul lecteur
  // reste monté, donc le plein écran dure d'une vidéo à l'autre. Passer à un
  // autre profil à la main (‹ ›) demande de relancer ; l'enchaînement, non.
  const videoRef = useRef<HTMLVideoElement>(null);
  // Barre du lecteur : visible en pause et quand la souris / le doigt bouge,
  // masquée après 2,5 s d'immobilité pendant la lecture (surtout en plein
  // écran, où elle restait affichée sur l'image).
  const [controles, setControles] = useState(true);
  const minuteurControles = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montrerControles = useCallback(() => {
    setControles(true);
    if (minuteurControles.current) clearTimeout(minuteurControles.current);
    minuteurControles.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControles(false);
    }, 2500);
  }, []);
  useEffect(
    () => () => {
      if (minuteurControles.current) clearTimeout(minuteurControles.current);
    },
    []
  );
  const [essai, setEssai] = useState(0);
  const [enchainer, setEnchainer] = useState(true);
  const [demarre, setDemarre] = useState(false);
  const [chaine, setChaine] = useState(false);
  const [essaiItemId, setEssaiItemId] = useState(item?.id);
  if (item?.id !== essaiItemId) {
    setEssaiItemId(item?.id);
    setEssai(0);
    setDemarre(chaine);
    setChaine(false);
  }

  function lancerVideo() {
    const lecteur = videoRef.current as (HTMLVideoElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    if (!lecteur) return;
    setDemarre(true);
    lecteur.play().catch(() => {});
    try {
      // Sans effet là où l'API n'existe pas (iPhone : le lecteur passe en plein
      // écran avec son propre bouton).
      const demande = lecteur.requestFullscreen?.() ?? lecteur.webkitRequestFullscreen?.();
      Promise.resolve(demande).catch(() => {});
    } catch {
      // Pas de plein écran possible ici : la fenêtre reste grande.
    }
  }

  const goPrev = useCallback(() => onIndexChange((index - 1 + items.length) % items.length), [index, items.length, onIndexChange]);
  const goNext = useCallback(() => onIndexChange((index + 1) % items.length), [index, items.length, onIndexChange]);

  // Fin d'une vidéo : l'essai suivant, sinon le prochain profil du rôle qui a
  // une vidéo ; à la fin de la liste, on s'arrête.
  function finDeVideo() {
    if (!enchainer || !item) return;
    if (essai < item.videoUrls.length - 1) {
      setEssai(essai + 1);
      return;
    }
    for (let i = index + 1; i < items.length; i++) {
      if (items[i].videoUrls.length > 0) {
        setChaine(true);
        onIndexChange(i);
        return;
      }
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const saisie = e.target instanceof HTMLElement && ["TEXTAREA", "INPUT", "SELECT"].includes(e.target.tagName);
      if (e.key === "Escape") onClose();
      else if (saisie) return;
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext, hasMultiple]);

  if (!item) return null;
  const video = item.videoUrls[essai] ?? item.videoUrls[0];
  const infos: { cle: string; valeur: string }[] = [
    ...(item.age !== null ? [{ cle: "", valeur: t(lang, "age_ans", { n: String(item.age) }) }] : []),
    ...(item.ville ? [{ cle: t(lang, "ville_label"), valeur: item.ville }] : []),
    ...item.mensurations.map((m) => ({ cle: t(lang, m.cle), valeur: m.valeur })),
  ];
  // Un profil déjà validé n'a plus besoin d'avis Oui / Peut-être / Non.
  const avisAffiche = !!reel?.avisActifs && !item.valide;
  const aDroite = infos.length > 0 || item.reponses.length > 0 || avisAffiche || reel?.commentairesActifs;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-2 pb-[4.5rem] sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-xl text-white hover:bg-danger"
        aria-label={t(lang, "fermer")}
      >
        ×
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute bottom-3 left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl text-white hover:bg-black sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
          aria-label={t(lang, "profil_precedent")}
        >
          ‹
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "grid max-h-[calc(100dvh-5.5rem)] w-full gap-x-5 gap-y-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-4 sm:max-h-[94vh] sm:p-5",
          "[grid-template-areas:'tete'_'video'_'avis'_'photos']",
          aDroite
            ? "max-w-6xl lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:[grid-template-areas:'video_tete'_'video_avis'_'photos_avis']"
            : "max-w-4xl lg:[grid-template-areas:'tete'_'video'_'photos']"
        )}
      >
        <div className="flex items-center gap-3 [grid-area:tete]">
          <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
            {item.portraitUrl && <Image src={item.portraitUrl} alt="" fill sizes="56px" className="object-cover" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-lg font-semibold leading-tight sm:text-xl">{item.nom}</span>
            <div className="flex flex-wrap gap-1.5">
              {(item.role ?? roleLabel) && <Badge>{item.role ?? roleLabel}</Badge>}
              {item.roleDate && <Badge>{item.roleDate}</Badge>}
              {afficherStatut && (
                <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
              )}
            </div>
          </div>
          {hasMultiple && <span className="shrink-0 text-xs tabular-nums text-text-muted">{index + 1} / {items.length}</span>}
        </div>

        <div className="flex min-w-0 flex-col gap-2 [grid-area:video]">
          {video ? (
            <>
              <div className="relative">
                <video
                  ref={videoRef}
                  src={video.url}
                  controls={controles}
                  autoPlay={demarre}
                  playsInline
                  preload="auto"
                  onEnded={finDeVideo}
                  onPlay={montrerControles}
                  onPause={() => {
                    if (minuteurControles.current) clearTimeout(minuteurControles.current);
                    setControles(true);
                  }}
                  onMouseMove={montrerControles}
                  onTouchStart={montrerControles}
                  onClick={montrerControles}
                  className={cn("aspect-video max-h-[70vh] w-full rounded-xl bg-black", !controles && "cursor-none")}
                />
                {!demarre && (
                  <button
                    type="button"
                    onClick={lancerVideo}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 text-white transition-colors hover:bg-black/45"
                    aria-label={t(lang, "lancer_video")}
                  >
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-black">
                      <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 fill-current" aria-hidden="true">
                        <path d="M7 4.5v15l13-7.5z" />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold">{t(lang, "lancer_video")}</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.videoUrls.length > 1 &&
                  item.videoUrls.map((v, i) => (
                    <button
                      key={v.url}
                      type="button"
                      onClick={() => setEssai(i)}
                      aria-pressed={i === essai}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        i === essai ? "border-text bg-text text-ink" : "border-border-strong bg-ink hover:border-text"
                      )}
                    >
                      {v.label || t(lang, "essai_n", { n: String(i + 1) })}
                    </button>
                  ))}
                {(item.videoUrls.length > 1 || hasMultiple) && (
                  <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={enchainer}
                      onChange={(e) => setEnchainer(e.target.checked)}
                      className="h-4 w-4 accent-coral"
                    />
                    {t(lang, "enchainer")}
                  </label>
                )}
              </div>
            </>
          ) : (
            item.portraitUrl && (
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[16rem] overflow-hidden rounded-xl bg-ink-raised-2">
                <Image src={item.portraitUrl} alt={item.nom} fill sizes="256px" className="object-cover" />
              </div>
            )
          )}
        </div>

        {aDroite && (
          <div className="flex min-w-0 flex-col gap-4 [grid-area:avis]">
            {infos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-sm">
                {infos.map((m) => (
                  <span key={`${m.cle}${m.valeur}`} className="rounded-full bg-ink px-3 py-1">
                    {m.cle && <span className="text-text-muted">{m.cle} </span>}
                    <span className="font-semibold">{m.valeur}</span>
                  </span>
                ))}
              </div>
            )}
            {item.reponses.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-ink px-3 py-2 text-sm">
                <span className="text-xs font-medium text-text-muted">{t(lang, "reponses_titre")}</span>
                {item.reponses.map((r) => (
                  <p key={r.question}>
                    {r.question}{" "}
                    <strong className={r.reponse === "oui" ? "text-turquoise" : "text-danger"}>{t(lang, r.reponse)}</strong>
                    {r.precision ? <span className="text-text-muted"> — {r.precision}</span> : null}
                  </p>
                ))}
              </div>
            )}
            {avisAffiche && <AvisProfil entryId={item.id} lang={lang} />}
            <CommentairesProfil entryId={item.id} lang={lang} />
          </div>
        )}

        {item.photos.length > 0 && (
          <div className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-5 [grid-area:photos]">
            {item.photos.map((p, i) => (
              <div key={p.url} className="relative flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-raised-2">
                  <Image src={p.url} alt={p.label} fill sizes="(min-width: 640px) 120px, 25vw" className="object-cover" />
                  <ZoomButton src={p.url} alt={p.label} gallery={gallery} index={i} />
                </div>
                <span className="text-center text-[11px] text-text-muted">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute bottom-3 right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl text-white hover:bg-black sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
          aria-label={t(lang, "profil_suivant")}
        >
          ›
        </button>
      )}
    </div>,
    document.body
  );
}

// Une carte "trombi" (grande photo, nom en dessous), pensée pour une grille
// de plusieurs profils par rôle. Le clic ouvre la salle de visionnage de ce
// profil, avec précédent/suivant pour parcourir les autres profils du même
// rôle. Mon avis s'affiche en pastille sur la photo.
export function CastingRealEntryCard({
  items,
  index,
  roleLabel,
  afficherStatut = true,
  masquerRole = false,
  lang = DEFAULT_LANG,
}: {
  items: CastingRealEntryItem[];
  index: number;
  roleLabel?: string | null;
  // Vrai sous un titre de rôle : le rôle et sa date ne sont pas répétés sur la carte.
  masquerRole?: boolean;
  // Faux dans la section « Profils validés » : le statut y est évident.
  afficherStatut?: boolean;
  lang?: Lang;
}) {
  const reel = useReel();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(index);
  const item = items[index];
  if (!item) return null;
  const hasMedia = item.videoUrls.length > 0 || item.photos.length > 0;
  // La fiche s'ouvre aussi sans vidéo/photo dès qu'il y a des infos à lire.
  const peutOuvrir = hasMedia || item.reponses.length > 0 || item.age !== null || item.mensurations.length > 0 || !!item.ville;
  const monAvis = reel?.mesAvis[item.id] ?? null;
  const taille = item.mensurations.find((m) => m.cle === "mens_taille")?.valeur ?? null;
  const ligneInfos = [item.age !== null ? t(lang, "age_ans", { n: String(item.age) }) : null, item.ville, taille].filter(Boolean).join(" · ");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!peutOuvrir) return;
          setCurrent(index);
          setOpen(true);
        }}
        disabled={!peutOuvrir}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-ink text-left transition-colors hover:border-coral/60 disabled:cursor-default disabled:hover:border-border"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-ink-raised-2">
          {item.portraitUrl && (
            <Image
              src={item.portraitUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          )}
          {monAvis && (
            <span
              className={cn(
                "absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-ink shadow",
                POINT_AVIS[monAvis]
              )}
              aria-label={t(lang, monAvis === "oui" ? "oui" : monAvis === "non" ? "non" : "avis_peut_etre")}
            >
              {AVIS.find((a) => a.valeur === monAvis)?.symbole}
            </span>
          )}
          {hasMedia && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
              {item.videoUrls.length > 0 && `${item.videoUrls.length} ${t(lang, item.videoUrls.length > 1 ? "videos" : "video")}`}
              {item.videoUrls.length > 0 && item.photos.length > 0 && " · "}
              {item.photos.length > 0 && `${item.photos.length} ${t(lang, item.photos.length > 1 ? "photos" : "photo")}`}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <span className="break-words text-base font-semibold leading-snug">{item.nom}</span>
          {ligneInfos && <span className="-mt-1 text-sm text-text-muted sm:truncate sm:text-xs">{ligneInfos}</span>}
          <div className="flex flex-wrap gap-1.5">
            {!masquerRole && (item.role ?? roleLabel) && <Badge>{item.role ?? roleLabel}</Badge>}
            {afficherStatut && (
              <Badge tone={item.valide ? "turquoise" : "yellow"}>{t(lang, item.valide ? "valide" : "a_valider")}</Badge>
            )}
          </div>
          {!masquerRole && item.roleDate && <span className="text-xs text-text-muted">{item.roleDate}</span>}
        </div>
      </button>
      {open && (
        <CastingRealMediaModal
          items={items}
          index={current}
          roleLabel={roleLabel}
          afficherStatut={afficherStatut}
          onIndexChange={setCurrent}
          onClose={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            setOpen(false);
          }}
          lang={lang}
        />
      )}
    </>
  );
}
