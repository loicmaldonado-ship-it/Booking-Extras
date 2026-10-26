"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "@/components/ui/image";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { LangToggle } from "@/components/partage/lang-toggle";
import type { Lang } from "@/lib/i18n/partage";
import { dateHeure, dateLongue, jourMois, ts, type SuiviKey } from "@/lib/i18n/suivi";
import { AccueilVisiteur, oublierVisiteur, useVisiteur } from "@/components/partage/visiteur";
import { signalerVisite, voterProfil, commenterLien } from "@/lib/validation/actions";
import type { Planche, VoteMes } from "@/lib/validation/data";

type VoteVu = { profilId: string; cle: string; qui: string; vote: VoteMes | null; note: string };
type CommentaireVu = { id: string; auteur: string; equipe: boolean; texte: string; created_at: string; profil: string | null };
// Seulement Oui ou Non (demande de Loïc) : pas de « peut-être » ici.
const VOTES: { v: VoteMes; label: "oui" | "non"; emoji: string; on: string }[] = [
  { v: "oui", label: "oui", emoji: "✅", on: "border-turquoise bg-turquoise text-ink" },
  { v: "non", label: "non", emoji: "🚫", on: "border-danger bg-danger text-white" },
];

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
  lang,
  source,
  titre,
  contexte,
  planches,
  jours,
  votes,
  commentaires,
}: {
  token: string;
  apercu: boolean;
  lang: Lang;
  // « bookings » : tous les profils sont déjà dans leurs journées, la
  // fonction du jour remplace « en cours de choix / dans la journée ».
  source: "candidatures" | "bookings";
  titre: string;
  contexte: string;
  planches: Planche[];
  // Toutes les dates de tournage de l'annonce.
  jours: string[];
  votes: VoteVu[];
  commentaires: CommentaireVu[];
}) {
  const router = useRouter();
  const moi = useVisiteur();
  const [maCle, setMaCle] = useState<string | null>(null);
  const [mesVotes, setMesVotes] = useState<Record<string, { vote: VoteMes | null; note: string }>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "a_voir" | VoteMes>("tous");
  const [jourFiltre, setJourFiltre] = useState<string>("tous");
  const [galerie, setGalerie] = useState<{ planche: number; photo: number } | null>(null);
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
      const v = maCle ? votes.find((x) => x.profilId === cid && x.cle === maCle) : undefined;
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

  const compte = (v: VoteMes) => planches.filter((p) => voteDe(p.profilId).vote === v).length;
  const aVoir = planches.filter((p) => !voteDe(p.profilId).vote).length;
  const visibles = planches
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      const v = voteDe(p.profilId).vote;
      return filtre === "tous" ? true : filtre === "a_voir" ? !v : v === filtre;
    });
  // Une section par journée de l'annonce (même vide) : les profils en
  // cours de choix (prévus) et ceux déjà dans la journée. Un profil sur deux
  // jours apparaît dans les deux (même vote).
  const dansJour = (p: Planche, d: string) => p.joursPrevus.includes(d) || p.joursJournee.includes(d);
  const sansJour = (p: Planche) => !jours.some((d) => dansJour(p, d));
  const sections =
    jours.length === 0
      ? [{ cle: "tous", date: null as string | null, titre: null as string | null, items: visibles }]
      : [
          ...jours.map((d) => ({ cle: d, date: d as string | null, titre: dateLongue(d, lang), items: visibles.filter(({ p }) => dansJour(p, d)) })),
          { cle: "sans", date: null, titre: ts(lang, "sans_jour_prevu"), items: visibles.filter(({ p }) => sansJour(p)) },
        ].filter((x) => (jourFiltre === "tous" || jourFiltre === x.cle) && (x.items.length > 0 || (x.date !== null && filtre === "tous")));

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
        <div className="flex items-center justify-between gap-3">
          <Logo iconSize={26} textClassName="text-lg" />
          <LangToggle lang={lang} basePath={`/partage/validation/${token}`} otherParams={{ apercu: apercu ? "1" : undefined }} />
        </div>
        {apercu && (
          <p className="rounded-xl border border-yellow/50 bg-yellow/10 px-3 py-2 text-sm">
            {ts(lang, "apercu")}
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {contexte && <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{contexte}</p>}
            <h1 className="text-2xl font-semibold">{titre}</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              {ts(lang, "consigne")}
            </p>
          </div>
          {moi && !apercu && (
            <p className="text-sm text-text-muted">
              {ts(lang, "vous")} : <b className="text-text">{moi.prenom}</b> · {moi.role} ·{" "}
              <button type="button" onClick={oublierVisiteur} className="font-medium text-coral underline">
                {ts(lang, "pas_moi")}
              </button>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer">
          {(
            [
              ["tous", `${ts(lang, "tous")} (${planches.length})`],
              ["a_voir", `${ts(lang, "a_voir")} (${aVoir})`],
              ["oui", `✅ ${ts(lang, "oui")} (${compte("oui")})`],
              ["non", `🚫 ${ts(lang, "non")} (${compte("non")})`],
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
        {jours.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jour de tournage">
            <span className="text-xs font-medium text-text-muted">📅 {ts(lang, "jour")} :</span>
            {[
              ["tous", ts(lang, "tous_les_jours")] as const,
              ...jours.map((d) => [d, `${jourMois(d)} (${planches.filter((p) => dansJour(p, d)).length})`] as const),
              ...(planches.some(sansJour) ? [["sans", `${ts(lang, "sans_jour")} (${planches.filter(sansJour).length})`] as const] : []),
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setJourFiltre(k)}
                aria-pressed={jourFiltre === k}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  jourFiltre === k ? "border-coral bg-coral/15 text-coral" : "border-border-strong hover:border-coral/60"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {erreur && <p className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
      </div>

      {sections.map((sec) => (
      <section key={sec.cle} className="flex flex-col gap-3">
        {sec.titre && (
          <h2 className="border-b-2 border-coral/50 pb-1 text-lg font-semibold">
            📅 {sec.titre}{" "}
            <span className="text-sm font-normal text-text-muted">
              · {sec.items.length} {ts(lang, sec.items.length > 1 ? "profils" : "profil")}
              {sec.date &&
                source === "candidatures" &&
                sec.items.length > 0 &&
                ` (${sec.items.filter(({ p }) => p.joursJournee.includes(sec.date!)).length} ${ts(lang, "dans_la_journee").toLowerCase()})`}
            </span>
          </h2>
        )}
        {sec.date && sec.items.length === 0 && <p className="text-sm text-text-muted">{ts(lang, "personne_jour")}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sec.items.map(({ p, i }) => {
          const mien = voteDe(p.profilId);
          const autres = votes.filter((v) => v.profilId === p.profilId && v.cle !== maCle && (v.vote || v.note));
          return (
            <article
              key={`${sec.cle}-${p.profilId}`}
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
                  aria-label={`${ts(lang, "agrandir")} ${p.nom}`}
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
                  {[p.age != null && `${p.age} ${ts(lang, "ans")}`, p.genre && (["Femme", "Homme", "Non-binaire", "Autre"].includes(p.genre) ? ts(lang, p.genre as SuiviKey) : p.genre)]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                {p.mesures.length > 0 && (
                  <p className="text-xs text-text-muted">
                    {p.mesures.map((m) => (m.cle === "taille" ? m.valeur : `${ts(lang, m.cle)} ${m.valeur}`)).join(" · ")}
                  </p>
                )}
                {sec.date && source === "bookings" ? (
                  p.fonctions[sec.date] && (
                    <span className="mt-1 inline-block rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">
                      {p.fonctions[sec.date]}
                    </span>
                  )
                ) : sec.date && (
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      p.joursJournee.includes(sec.date) ? "bg-turquoise text-white" : "bg-yellow/20 text-yellow"
                    )}
                  >
                    {p.joursJournee.includes(sec.date) ? `✓ ${ts(lang, "dans_la_journee")}` : `⏳ ${ts(lang, "en_cours")}`}
                  </span>
                )}
                {p.joursPrevus.length + p.joursJournee.length > 0 ? (
                  <p className="mt-1 text-xs font-medium text-coral">
                    📅 {Array.from(new Set([...p.joursPrevus, ...p.joursJournee])).sort().map(jourMois).join(", ")}
                  </p>
                ) : (
                  p.joursDispo.length > 0 && <p className="mt-1 text-xs text-text-muted">{ts(lang, "dispo_le")} {p.joursDispo.map(jourMois).join(", ")}</p>
                )}
                {p.questions.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted">
                    {p.questions.map((q, k) => (
                      <span key={k}>
                        {q.label} <b className={q.reponse ? "text-turquoise" : "text-danger"}>{ts(lang, q.reponse ? "oui" : "non")}</b>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {VOTES.map((b) => (
                  <button
                    key={b.v}
                    type="button"
                    disabled={apercu || !moi}
                    onClick={() => voter(p.profilId, mien.vote === b.v ? null : b.v, mien.note)}
                    aria-pressed={mien.vote === b.v}
                    className={cn(
                      "rounded-xl border-2 px-1 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                      mien.vote === b.v ? b.on : "border-border-strong hover:border-coral/60"
                    )}
                  >
                    {b.emoji} {ts(lang, b.label)}
                  </button>
                ))}
              </div>
              {!apercu && moi && (
                <input
                  key={`${p.profilId}-${mien.note}`}
                  defaultValue={mien.note}
                  onBlur={(e) => e.target.value.trim() !== mien.note && voter(p.profilId, mien.vote, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder={ts(lang, "note")}
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
      </div>
      </section>
      ))}
      {sections.length === 0 && <p className="py-8 text-center text-text-muted">Aucun profil ici.</p>}

      <section className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-4">
        <h2 className="text-base font-semibold">💬 {ts(lang, "commentaires_titre")}</h2>
        {commentaires.length === 0 ? (
          <p className="text-sm text-text-muted">{ts(lang, "aucun_commentaire")}</p>
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
                  {c.equipe ? `${c.auteur} · ${ts(lang, "equipe_casting")}` : c.auteur}
                  {c.profil && ` · ${ts(lang, "sur")} ${c.profil}`} · {dateHeure(c.created_at, lang)}
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
              aria-label={ts(lang, "a_propos")}
              className="rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm"
            >
              <option value="">{ts(lang, "a_propos_tous")}</option>
              {planches.map((p) => (
                <option key={p.profilId} value={p.profilId}>
                  {ts(lang, "a_propos")} {p.nom}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <textarea
                value={com}
                onChange={(e) => setCom(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={ts(lang, "un_mot")}
                className="flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={envoyerCommentaire}
                disabled={comPending || !com.trim()}
                className="self-end rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
              >
                {ts(lang, "envoyer")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Arrivée : prénom et rôle, une seule fois sur cet appareil (commun à
          tous les liens de partage). */}
      {!apercu && !moi && <AccueilVisiteur lang={lang} />}

      {pg && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label={`Photos de ${pg.nom}`}>
          <button
            type="button"
            onClick={() => setGalerie(null)}
            className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-sm text-white"
          >
            {ts(lang, "fermer")} <X size={16} />
          </button>
          <p className="absolute left-4 top-5 text-sm text-white/80">
            {pg.nom} · {photoG?.label} · {galerie!.photo + 1}/{pg.photos.length}
          </p>
          {pg.photos.length > 1 && (
            <button
              type="button"
              onClick={() => setGalerie((g) => g && { ...g, photo: (g.photo - 1 + pg.photos.length) % pg.photos.length })}
              className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white"
              aria-label={ts(lang, "photo_prec")}
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
              aria-label={ts(lang, "photo_suiv")}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
