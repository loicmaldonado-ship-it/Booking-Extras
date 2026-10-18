"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format-date";
import {
  creerLienValidation,
  ajouterAuLienValidation,
  supprimerLienValidation,
  repondreSurLien,
} from "@/lib/validation/actions";
import type { LienResume } from "@/lib/validation/data";

const bouton = "rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60";

// Liens de validation pour la mise en scène / la réalisation, dans la barre
// de sélection de Candidatures : créer un lien depuis les profils cochés
// (ou l'onglet affiché), suivre qui l'a ouvert, les votes et les
// commentaires, répondre.
export function LiensValidation({
  annonceId,
  nomParDefaut,
  liens,
  selectionIds,
  listeIds,
  origin,
}: {
  annonceId: string;
  nomParDefaut: string;
  liens: LienResume[];
  selectionIds: string[];
  // Toute la liste affichée (onglet + filtres), quand rien n'est coché.
  listeIds: string[];
  origin: string;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(nomParDefaut);
  const [cree, setCree] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(liens[0]?.id ?? null);
  const [copie, setCopie] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const ids = selectionIds.length > 0 ? selectionIds : listeIds;
  const url = (token: string) => `${origin}/partage/validation/${token}`;

  // Votes, visites et commentaires arrivent en direct : rafraîchi toutes
  // les 30 s tant que le panneau est ouvert.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  function creer() {
    setMessage(null);
    startTransition(async () => {
      const res = await creerLienValidation(annonceId, nom, ids);
      if (res.error) setMessage({ ok: false, texte: res.error });
      else if (res.token) {
        setCree(res.token);
        router.refresh();
      }
    });
  }

  async function copier(token: string) {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopie(token);
    } catch {
      setMessage({ ok: false, texte: "Copie impossible sur cet appareil : sélectionne le lien à la main." });
    }
  }

  function ajouter(lienId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await ajouterAuLienValidation(lienId, selectionIds);
      setMessage(
        res.error
          ? { ok: false, texte: res.error }
          : { ok: true, texte: `${res.ajoutes} profil${(res.ajoutes ?? 0) > 1 ? "s" : ""} ajouté${(res.ajoutes ?? 0) > 1 ? "s" : ""} au lien.` }
      );
      router.refresh();
    });
  }

  function supprimer(lienId: string) {
    startTransition(async () => {
      const res = await supprimerLienValidation(lienId);
      if (res.error) setMessage({ ok: false, texte: res.error });
      setASupprimer(null);
      router.refresh();
    });
  }

  function repondre(lienId: string) {
    const texte = reponses[lienId]?.trim();
    if (!texte) return;
    startTransition(async () => {
      const res = await repondreSurLien(lienId, texte);
      if (res.error) setMessage({ ok: false, texte: res.error });
      else setReponses((r) => ({ ...r, [lienId]: "" }));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-coral/40 bg-ink p-3">
      <div>
        <b className="text-sm">🔗 Lien de validation pour la mise en scène</b>
        <p className="text-xs text-text-muted">
          Les profils en planches (plusieurs photos, âge, mensurations, réponses aux questions — jamais les coordonnées ni le
          message). La MES répond Oui ou Non pour chaque profil (par jour prévu s&apos;ils ont des jours) ; tu le vois ici et sur les cartes (🎬), puis tu envoies les
          validés dans la journée.
        </p>
      </div>

      {cree ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-turquoise/50 bg-turquoise/10 p-2 text-sm">
          <span className="font-medium text-turquoise">✓ Lien créé</span>
          <code className="min-w-0 flex-1 truncate text-xs">{url(cree)}</code>
          <button type="button" onClick={() => copier(cree)} className={bouton}>
            {copie === cree ? "Copié ✓" : "Copier le lien"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCree(null);
              setNom(nomParDefaut);
            }}
            className={bouton}
          >
            Créer un autre lien
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-text-muted">
            Nom du lien (vu par la MES)
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              maxLength={120}
              className="rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm text-text outline-none focus:border-coral"
            />
          </label>
          <button
            type="button"
            onClick={creer}
            disabled={pending || ids.length === 0 || !nom.trim()}
            className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
          >
            Créer le lien avec {ids.length} profil{ids.length > 1 ? "s" : ""}
            {selectionIds.length > 0 ? " cochés" : " de l'onglet"}
          </button>
        </div>
      )}

      {message && <p className={cn("text-xs", message.ok ? "text-turquoise" : "text-danger")}>{message.texte}</p>}

      {liens.length > 0 && (
        <div className="flex flex-col gap-2">
          <b className="text-xs text-text-muted">Liens déjà créés</b>
          {liens.map((l) => {
            const enLigne = l.visites.filter((v) => v.enLigne).length;
            const estOuvert = ouvert === l.id;
            return (
              <div key={l.id} className="flex flex-col gap-2 rounded-lg border border-border bg-ink-raised p-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    🔗 <b>{l.nom}</b>
                    <span className="text-xs text-text-muted">
                      {" "}
                      · {formatDateTime(l.created_at)}
                      {l.auteur && ` · ${l.auteur}`}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs">
                    {enLigne > 0 && (
                      <span className="flex items-center gap-1 font-medium text-turquoise">
                        <span className="h-2 w-2 rounded-full bg-turquoise" /> {enLigne} en ligne
                      </span>
                    )}
                    <b className="text-turquoise">✅ {l.oui}</b>
                    <span>🚫 {l.non}</span>
                    <span className="text-text-muted">/ {l.candidatureIds.length}</span>
                    <span>💬 {l.commentaires.length}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => copier(l.token)} className={bouton}>
                    {copie === l.token ? "Copié ✓" : "Copier le lien"}
                  </button>
                  <a href={`${url(l.token)}?apercu=1`} target="_blank" rel="noreferrer" className={bouton}>
                    👀 Voir comme la MES
                  </a>
                  <button type="button" onClick={() => setOuvert(estOuvert ? null : l.id)} aria-expanded={estOuvert} className={bouton}>
                    {estOuvert ? "Replier" : "Visites et commentaires"}
                  </button>
                  {selectionIds.length > 0 && (
                    <button type="button" disabled={pending} onClick={() => ajouter(l.id)} className={bouton}>
                      ＋ Ajouter les {selectionIds.length} cochés
                    </button>
                  )}
                  {aSupprimer === l.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      Supprimer ce lien (votes et commentaires compris) ?
                      <button type="button" onClick={() => setASupprimer(null)} className={bouton}>
                        Non
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => supprimer(l.id)}
                        className="rounded-full border border-danger bg-danger px-3 py-1 text-xs font-semibold text-white"
                      >
                        Supprimer
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setASupprimer(l.id)} className={cn(bouton, "text-danger")}>
                      Supprimer
                    </button>
                  )}
                </div>

                {estOuvert && (
                  <div className="grid gap-3 border-t border-border pt-2 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <b className="text-xs text-text-muted">👁 Qui a ouvert le lien</b>
                      {l.visites.length === 0 && <span className="text-xs text-text-muted">Personne pour l&apos;instant.</span>}
                      {l.visites.map((v) => (
                        <div key={v.visiteur_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", v.enLigne ? "bg-turquoise" : "bg-border-strong")} />
                            <b>{v.prenom}</b>
                            {v.role && <span className="text-text-muted">· {v.role}</span>}
                          </span>
                          <span className="text-text-muted">
                            {v.enLigne ? <b className="text-turquoise">En ligne</b> : `vu ${formatDateTime(v.derniere_vue)}`} · {v.votes} vote
                            {v.votes > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <b className="text-xs text-text-muted">💬 Commentaires</b>
                      {l.commentaires.length === 0 && <span className="text-xs text-text-muted">Aucun commentaire.</span>}
                      {l.commentaires.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs",
                            c.equipe ? "self-end bg-coral/10" : "self-start border border-border bg-ink"
                          )}
                        >
                          <span className="block text-[10px] text-text-muted">
                            {c.auteur}
                            {c.profil && ` · sur ${c.profil}`} · {formatDateTime(c.created_at)}
                          </span>
                          <span className="whitespace-pre-wrap">{c.texte}</span>
                        </div>
                      ))}
                      <div className="flex gap-1.5">
                        <input
                          value={reponses[l.id] ?? ""}
                          onChange={(e) => setReponses((r) => ({ ...r, [l.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && repondre(l.id)}
                          placeholder="Répondre à la MES / au réal…"
                          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-xs outline-none focus:border-coral"
                        />
                        <button type="button" disabled={pending || !reponses[l.id]?.trim()} onClick={() => repondre(l.id)} className={bouton}>
                          Envoyer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
