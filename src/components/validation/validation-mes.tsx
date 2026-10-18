"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { formatDateTime } from "@/lib/format-date";
import { signalerVisite, voterProfil, commenterLien } from "@/lib/validation/actions";
import type { Planche, VoteMes } from "@/lib/validation/data";

type VoteVu = { candidatureId: string; cle: string; qui: string; vote: VoteMes | null; note: string };
type CommentaireVu = { id: string; auteur: string; equipe: boolean; texte: string; created_at: string; profil: string | null };
type Visiteur = { id: string; prenom: string; role: string };

const CLE_STOCKAGE = "be-visiteur-validation";
const ROLES = ["Réalisation", "Mise en scène", "1er assistant·e", "Production", "Autre"];

const VOTES: { v: VoteMes; label: string; emoji: string; on: string }[] = [
  { v: "oui", label: "Valider", emoji: "✅", on: "border-turquoise bg-turquoise text-ink" },
  { v: "peut", label: "Peut-être", emoji: "🤔", on: "border-yellow bg-yellow text-ink" },
  { v: "non", label: "Non", emoji: "🚫", on: "border-danger bg-danger text-white" },
];

// Identité de l'appareil (prénom + rôle), gardée dans le navigateur.
let memoire: string | null = null;
const abonnes = new Set<() => void>();
function lireVisiteurBrut() {
  try {
    return localStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
}
function abonner(cb: () => void) {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}
function enregistrerVisiteur(v: Visiteur) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(v));
  } catch {
    // Navigation privée : l'identité ne tiendra que le temps de la page.
    memoire = JSON.stringify(v);
  }
  abonnes.forEach((cb) => cb());
}

async function empreinte(id: string) {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(octets))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export function ValidationMes({
  token,
  apercu,
  titre,
  contexte,
  planches,
  votes,
  commentaires,
}: {
  token: string;
  apercu: boolean;
  titre: string;
  contexte: string;
  planches: Planche[];
  votes: VoteVu[];
  commentaires: CommentaireVu[];
}) {
  const router = useRouter();
  const brut = useSyncExternalStore(abonner, () => lireVisiteurBrut() ?? memoire, () => null);
  const moi = useMemo<Visiteur | null>(() => {
    try {
      const v = brut ? (JSON.parse(brut) as Visiteur) : null;
      return v?.id && v.prenom ? v : null;
    } catch {
      return null;
    }
  }, [brut]);
  const [maCle, setMaCle] = useState<string | null>(null);
  const [mesVotes, setMesVotes] = useState<Record<string, { vote: VoteMes | null; note: string }>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "a_voir" | VoteMes>("tous");
  const [galerie, setGalerie] = useState<{ planche: number; photo: number } | null>(null);
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [com, setCom] = useState("");
  const [comProfil, setComProfil] = useState("");
  const [comPending, startCom] = useTransition();

  useEffect(() => {
    if (!moi) return;
    let annule = false;
    empreinte(moi.id).then((c) => {
      if (!annule) setMaCle(c);
    });
    return () => {
      annule = true;
    };
  }, [moi]);

  // Présence : signalée à l'arrivée puis toutes les 30 s ; la page se
  // rafraîchit en même temps (votes des autres, réponses de l'équipe).
  useEffect(() => {
    if (apercu) return;
    const tic = () => {
      if (moi) signalerVisite(token, moi.id, moi.prenom, moi.role);
      router.refresh();
    };
    if (moi) signalerVisite(token, moi.id, moi.prenom, moi.role);
    const id = setInterval(tic, 30_000);
    return () => clearInterval(id);
  }, [apercu, moi, token, router]);

  const voteDe = useCallback(
    (cid: string) => {
      if (mesVotes[cid]) return mesVotes[cid];
      const v = maCle ? votes.find((x) => x.candidatureId === cid && x.cle === maCle) : undefined;
      return { vote: v?.vote ?? null, note: v?.note ?? "" };
    },
    [mesVotes, maCle, votes]
  );

  function voter(cid: string, vote: VoteMes | null, note: string) {
    if (!moi || apercu) return;
    const avant = voteDe(cid);
    setErreur(null);
    setMesVotes((p) => ({ ...p, [cid]: { vote, note } }));
    voterProfil(token, moi.id, cid, vote, note).then((res) => {
      if (res.error) {
        setMesVotes((p) => ({ ...p, [cid]: avant }));
        setErreur(res.error);
      }
    });
  }

  function arriver(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim()) return;
    enregistrerVisiteur({ id: crypto.randomUUID(), prenom: prenom.trim().slice(0, 60), role });
  }

  function envoyerCommentaire() {
    if (!moi || !com.trim()) return;
    setErreur(null);
    startCom(async () => {
      const res = await commenterLien(token, moi.id, com, comProfil || null);
      if (res.error) setErreur(res.error);
      else {
        setCom("");
        setComProfil("");
        router.refresh();
      }
    });
  }

  const compte = (v: VoteMes) => planches.filter((p) => voteDe(p.candidatureId).vote === v).length;
  const aVoir = planches.filter((p) => !voteDe(p.candidatureId).vote).length;
  const visibles = planches
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      const v = voteDe(p.candidatureId).vote;
      return filtre === "tous" ? true : filtre === "a_voir" ? !v : v === filtre;
    });

  // Galerie plein écran : flèches, Échap.
  useEffect(() => {
    if (!galerie) return;
    const n = planches[galerie.planche]?.photos.length ?? 0;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setGalerie(null);
      if (e.key === "ArrowRight") setGalerie((g) => g && { ...g, photo: (g.photo + 1) % Math.max(1, n) });
      if (e.key === "ArrowLeft") setGalerie((g) => g && { ...g, photo: (g.photo - 1 + n) % Math.max(1, n) });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galerie, planches]);

  const pg = galerie ? planches[galerie.planche] : null;
  const photoG = pg?.photos[galerie!.photo];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Logo iconSize={26} textClassName="text-lg" />
        {apercu && (
          <p className="rounded-xl border border-yellow/50 bg-yellow/10 px-3 py-2 text-sm">
            👀 Aperçu équipe : c&apos;est ce que voit la mise en scène. Les votes et commentaires sont désactivés ici.
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {contexte && <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{contexte}</p>}
            <h1 className="text-2xl font-semibold">{titre}</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              Touchez une photo pour l&apos;agrandir. Validez, mettez en « peut-être » ou écartez chaque profil : l&apos;équipe
              casting le voit tout de suite.
            </p>
          </div>
          {moi && !apercu && (
            <p className="text-sm text-text-muted">
              Vous : <b className="text-text">{moi.prenom}</b> · {moi.role}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer">
          {(
            [
              ["tous", `Tous (${planches.length})`],
              ["a_voir", `À voir (${aVoir})`],
              ["oui", `✅ Validés (${compte("oui")})`],
              ["peut", `🤔 Peut-être (${compte("peut")})`],
              ["non", `🚫 Non (${compte("non")})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltre(k)}
              aria-pressed={filtre === k}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                filtre === k ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {erreur && <p className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map(({ p, i }) => {
          const mien = voteDe(p.candidatureId);
          const autres = votes.filter((v) => v.candidatureId === p.candidatureId && v.cle !== maCle && (v.vote || v.note));
          return (
            <article
              key={p.candidatureId}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border-2 bg-ink-raised p-3",
                mien.vote === "oui" ? "border-turquoise" : mien.vote === "non" ? "border-danger/60" : mien.vote === "peut" ? "border-yellow" : "border-border"
              )}
            >
              <div className="grid grid-cols-[2fr_1fr] gap-1.5">
                <button
                  type="button"
                  onClick={() => setGalerie({ planche: i, photo: 0 })}
                  className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink-raised-2"
                  aria-label={`Agrandir les photos de ${p.nom}`}
                >
                  {p.photos[0] && <Image src={p.photos[0].url} alt="" fill sizes="(max-width: 640px) 66vw, 260px" className="object-cover" />}
                </button>
                <div className="flex flex-col gap-1.5">
                  {p.photos.slice(1, 3).map((ph, k) => (
                    <button
                      key={ph.url}
                      type="button"
                      onClick={() => setGalerie({ planche: i, photo: k + 1 })}
                      className="relative flex-1 overflow-hidden rounded-lg bg-ink-raised-2"
                      aria-label={`${ph.label} de ${p.nom}`}
                    >
                      <Image src={ph.url} alt="" fill sizes="130px" className="object-cover" />
                      {k === 1 && p.photos.length > 3 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-semibold text-white">
                          +{p.photos.length - 3}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">{p.nom}</h2>
                <p className="text-sm text-text-muted">
                  {[p.age != null && `${p.age} ans`, p.genre].filter(Boolean).join(" · ") || "—"}
                </p>
                {p.mesures && <p className="text-xs text-text-muted">{p.mesures}</p>}
                {p.questions.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted">
                    {p.questions.map((q, k) => (
                      <span key={k}>
                        {q.label} <b className={q.reponse ? "text-turquoise" : "text-danger"}>{q.reponse ? "oui" : "non"}</b>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {VOTES.map((b) => (
                  <button
                    key={b.v}
                    type="button"
                    disabled={apercu || !moi}
                    onClick={() => voter(p.candidatureId, mien.vote === b.v ? null : b.v, mien.note)}
                    aria-pressed={mien.vote === b.v}
                    className={cn(
                      "rounded-xl border-2 px-1 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                      mien.vote === b.v ? b.on : "border-border-strong hover:border-coral/60"
                    )}
                  >
                    {b.emoji} {b.label}
                  </button>
                ))}
              </div>
              {!apercu && moi && (
                <input
                  key={`${p.candidatureId}-${mien.note}`}
                  defaultValue={mien.note}
                  onBlur={(e) => e.target.value.trim() !== mien.note && voter(p.candidatureId, mien.vote, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Une note sur ce profil (optionnel)"
                  maxLength={500}
                  className="rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral"
                />
              )}
              {autres.length > 0 && (
                <ul className="flex flex-col gap-0.5 border-t border-border pt-2 text-xs text-text-muted">
                  {autres.map((v, k) => (
                    <li key={k}>
                      {v.qui} : {v.vote === "oui" ? "✅" : v.vote === "peut" ? "🤔" : v.vote === "non" ? "🚫" : ""}
                      {v.note && <span className="italic"> « {v.note} »</span>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
        {visibles.length === 0 && <p className="col-span-full py-8 text-center text-text-muted">Aucun profil ici.</p>}
      </div>

      <section className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-4">
        <h2 className="text-base font-semibold">💬 Commentaires pour l&apos;équipe casting</h2>
        {commentaires.length === 0 ? (
          <p className="text-sm text-text-muted">Pas encore de commentaire.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {commentaires.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  c.equipe ? "self-start bg-coral/10" : "self-end border border-border bg-ink"
                )}
              >
                <span className="block text-[11px] text-text-muted">
                  {c.equipe ? `${c.auteur} · équipe casting` : c.auteur}
                  {c.profil && ` · sur ${c.profil}`} · {formatDateTime(c.created_at)}
                </span>
                <span className="whitespace-pre-wrap">{c.texte}</span>
              </li>
            ))}
          </ul>
        )}
        {!apercu && moi && (
          <div className="flex flex-col gap-2">
            <select
              value={comProfil}
              onChange={(e) => setComProfil(e.target.value)}
              aria-label="À propos de"
              className="rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm"
            >
              <option value="">À propos de : tout le monde</option>
              {planches.map((p) => (
                <option key={p.candidatureId} value={p.candidatureId}>
                  À propos de : {p.nom}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <textarea
                value={com}
                onChange={(e) => setCom(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Un mot pour l'équipe casting…"
                className="flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={envoyerCommentaire}
                disabled={comPending || !com.trim()}
                className="self-end rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Arrivée : prénom et rôle, une seule fois sur cet appareil. */}
      {!apercu && !moi && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Qui êtes-vous ?">
          <form onSubmit={arriver} className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-5">
            <h2 className="text-xl font-semibold">Bonjour 👋</h2>
            <p className="text-sm text-text-muted">Pour que l&apos;équipe casting sache qui valide et qui commente :</p>
            <label className="flex flex-col gap-1 text-sm">
              Votre prénom
              <input
                autoFocus
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                maxLength={60}
                className="rounded-lg border border-border-strong bg-ink px-3 py-2 outline-none focus:border-coral"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Votre rôle
              <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-border-strong bg-ink px-3 py-2">
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-full bg-coral px-4 py-2.5 font-semibold text-ink hover:bg-coral-hover">
              Voir les profils
            </button>
            <span className="text-xs text-text-muted">Demandé une seule fois sur cet appareil.</span>
          </form>
        </div>
      )}

      {pg && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label={`Photos de ${pg.nom}`}>
          <button
            type="button"
            onClick={() => setGalerie(null)}
            className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-sm text-white"
          >
            Fermer <X size={16} />
          </button>
          <p className="absolute left-4 top-5 text-sm text-white/80">
            {pg.nom} · {photoG?.label} · {galerie!.photo + 1}/{pg.photos.length}
          </p>
          {pg.photos.length > 1 && (
            <button
              type="button"
              onClick={() => setGalerie((g) => g && { ...g, photo: (g.photo - 1 + pg.photos.length) % pg.photos.length })}
              className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white"
              aria-label="Photo précédente"
            >
              <ChevronLeft />
            </button>
          )}
          <div className="relative h-[85vh] w-full max-w-4xl">
            {photoG && <Image key={photoG.url} src={photoG.url} alt={photoG.label} fill sizes="100vw" className="object-contain" priority />}
          </div>
          {pg.photos.length > 1 && (
            <button
              type="button"
              onClick={() => setGalerie((g) => g && { ...g, photo: (g.photo + 1) % pg.photos.length })}
              className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white"
              aria-label="Photo suivante"
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
