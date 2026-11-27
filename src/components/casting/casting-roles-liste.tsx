"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCastingRoleCard } from "@/components/casting/new-casting-role-card";
import { creerOnglet, renommerOnglet, supprimerOnglet, rangerRoles } from "@/lib/casting/onglet-actions";
import { setCastingRolePosition } from "@/lib/casting/actions";
import type { CategorieCachet } from "@/lib/casting/types";
import { cn } from "@/lib/cn";

// Où en est un rôle : de ce qui demande de l'action à ce qui est fini.
export type EtatRole = "a_traiter" | "sans_profil" | "en_attente" | "valide";

const ETATS: { value: EtatRole; label: string; badge: string }[] = [
  { value: "a_traiter", label: "À traiter", badge: "bg-yellow/15 text-yellow" },
  { value: "sans_profil", label: "Sans profil", badge: "bg-ink-raised-2 text-text-muted" },
  { value: "en_attente", label: "En attente de retour", badge: "bg-coral/15 text-coral" },
  { value: "valide", label: "Validé", badge: "bg-turquoise/15 text-turquoise" },
];

export type ItemRole = {
  id: string;
  nom: string;
  nbProfils: number;
  etat: EtatRole;
  ongletId: string | null;
  // Numéro d'ordre du rôle dans sa catégorie (celui qu'on peut changer).
  position: number;
  // Initiales des premiers profils, pour la carte.
  initiales: string[];
  // Carte complète du rôle (profils, vidéos, invitation…), affichée au clic.
  carte: ReactNode;
};

type Onglet = { id: string; nom: string };
// « all » = tous les rôles, « none » = rôles sans onglet, sinon l'id d'un onglet.
type Vue = "all" | "none" | string;

const boutonClair =
  "rounded-full border-2 border-border-strong px-4 py-1.5 text-sm font-semibold hover:border-text disabled:opacity-40";

// Page Casting : des onglets créés par la cheffe, et dans chacun une grille de
// cartes (une par rôle). Un clic sur une carte ouvre le rôle en grand.
export function CastingRolesListe({
  projetId,
  categorie,
  onglets,
  items,
}: {
  projetId: string;
  categorie: CategorieCachet;
  onglets: Onglet[];
  items: ItemRole[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vue, setVue] = useState<Vue>("all");
  const [filtre, setFiltre] = useState<EtatRole | null>(null);
  const [recherche, setRecherche] = useState("");
  const [parAction, setParAction] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [panneau, setPanneau] = useState<"nouveau" | "renommer" | null>(null);
  const [nomSaisi, setNomSaisi] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  // Rangements faits à l'écran, affichés tout de suite avant le retour du serveur.
  const [rangements, setRangements] = useState<Record<string, string | null>>({});

  const vueEffective: Vue = vue === "all" || vue === "none" || onglets.some((o) => o.id === vue) ? vue : "all";
  const ongletCourant = onglets.find((o) => o.id === vueEffective) ?? null;
  const ongletDe = (it: ItemRole) => (it.id in rangements ? rangements[it.id] : it.ongletId);
  // Dans l'onglet « Le Migrant », inutile de répéter « Le Migrant · » devant chaque rôle importé.
  const nomAffiche = (it: ItemRole) =>
    ongletCourant && it.nom.startsWith(`${ongletCourant.nom} · `) ? it.nom.slice(ongletCourant.nom.length + 3) : it.nom;

  const dansVue = useMemo(
    () =>
      items.filter((it) => {
        const o = it.id in rangements ? rangements[it.id] : it.ongletId;
        return vueEffective === "all" ? true : vueEffective === "none" ? !o : o === vueEffective;
      }),
    [items, rangements, vueEffective]
  );

  const compteurs = useMemo(() => {
    const c: Record<EtatRole, number> = { a_traiter: 0, sans_profil: 0, en_attente: 0, valide: 0 };
    for (const it of dansVue) c[it.etat]++;
    return c;
  }, [dansVue]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtres = dansVue.filter((it) => (!filtre || it.etat === filtre) && (!q || it.nom.toLowerCase().includes(q)));
    if (!parAction) return filtres;
    const rang = new Map(ETATS.map((e, i) => [e.value, i]));
    return [...filtres].sort((a, b) => rang.get(a.etat)! - rang.get(b.etat)!);
  }, [dansVue, filtre, recherche, parAction]);

  const sansOnglet = items.filter((it) => !(it.id in rangements ? rangements[it.id] : it.ongletId)).length;
  const nbDans = (id: string) => items.filter((it) => (it.id in rangements ? rangements[it.id] : it.ongletId) === id).length;

  function ranger(roleIds: string[], ongletId: string | null) {
    setErreur(null);
    setRangements((prev) => ({ ...prev, ...Object.fromEntries(roleIds.map((id) => [id, ongletId])) }));
    startTransition(async () => {
      const res = await rangerRoles(projetId, roleIds, ongletId);
      if (res.error) setErreur(res.error);
      router.refresh();
    });
  }

  function validerNom() {
    setErreur(null);
    startTransition(async () => {
      if (panneau === "nouveau") {
        const res = await creerOnglet(projetId, nomSaisi);
        if (res.error) return setErreur(res.error);
        if (res.id) setVue(res.id);
      } else if (panneau === "renommer" && ongletCourant) {
        const res = await renommerOnglet(ongletCourant.id, nomSaisi);
        if (res.error) return setErreur(res.error);
      }
      setPanneau(null);
      router.refresh();
    });
  }

  function supprimer() {
    if (!ongletCourant) return;
    if (!window.confirm(`Supprimer l'onglet « ${ongletCourant.nom} » ? Ses rôles ne sont pas supprimés : ils passent dans « Sans onglet ».`)) return;
    startTransition(async () => {
      const res = await supprimerOnglet(ongletCourant.id);
      if (res.error) return setErreur(res.error);
      setVue("none");
      router.refresh();
    });
  }

  // Un onglet du classeur : mêmes onglets arrondis que la page Candidatures.
  const onglet = (id: Vue, label: ReactNode, n: number) => {
    const actif = vueEffective === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={actif}
        onClick={() => {
          setVue(id);
          setPanneau(null);
          setDetail(null);
        }}
        onDragOver={(e) => id !== "all" && e.preventDefault()}
        onDrop={(e) => {
          if (id === "all") return;
          e.preventDefault();
          const roleId = e.dataTransfer.getData("text/plain");
          if (roleId) ranger([roleId], id === "none" ? null : id);
        }}
        className={cn(
          "-mb-0.5 flex items-center gap-1.5 rounded-t-xl border-2 px-3.5 py-2 text-sm font-medium transition-colors",
          actif
            ? "border-border border-b-ink bg-ink text-text"
            : "border-transparent text-text-muted hover:bg-ink-raised hover:text-text"
        )}
      >
        {label}
        <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", actif ? "bg-coral/15 text-coral" : "bg-ink-raised-2")}>
          {n}
        </span>
      </button>
    );
  };

  function changerNumero(roleId: string, valeur: string, actuel: number) {
    const n = Math.trunc(Number(valeur));
    if (!Number.isFinite(n) || n < 1 || n === actuel) return;
    setErreur(null);
    startTransition(async () => {
      const res = await setCastingRolePosition(roleId, n);
      if (res.error) setErreur(res.error);
      router.refresh();
    });
  }

  // ----- Vue détail : un rôle en grand -----
  if (detail) {
    const idx = visibles.findIndex((it) => it.id === detail);
    const it = items.find((x) => x.id === detail);
    if (it) {
      const etat = ETATS.find((e) => e.value === it.etat)!;
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={boutonClair} onClick={() => setDetail(null)}>
              ‹ Retour aux cartes
            </button>
            <span className={cn("rounded-full px-3 py-1 text-xs font-medium", etat.badge)}>{etat.label}</span>
            {idx >= 0 && (
              <span className="text-sm text-text-muted">
                {idx + 1} sur {visibles.length}
              </span>
            )}
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-sm">
              Ranger dans
              <select
                value={ongletDe(it) ?? ""}
                onChange={(e) => ranger([it.id], e.target.value || null)}
                className="rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
              >
                <option value="">Aucun onglet</option>
                {onglets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nom}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={boutonClair} disabled={idx <= 0} onClick={() => setDetail(visibles[idx - 1].id)}>
              ‹
            </button>
            <button
              type="button"
              className={boutonClair}
              disabled={idx < 0 || idx >= visibles.length - 1}
              onClick={() => setDetail(visibles[idx + 1].id)}
            >
              ›
            </button>
          </div>
          {erreur && <p className="text-sm text-danger">{erreur}</p>}
          <div key={it.id}>{it.carte}</div>
        </div>
      );
    }
  }

  // ----- Vue grille : onglets + cartes -----
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Onglets du casting" className="flex flex-wrap items-end gap-1 border-b-2 border-border">
        {onglets.length > 0 && sansOnglet > 0 && onglet("none", "📥 Sans onglet", sansOnglet)}
        {onglets.map((o) => onglet(o.id, `🗂️ ${o.nom}`, nbDans(o.id)))}
        {onglet("all", "👥 Tous", items.length)}
        {panneau === "nouveau" ? (
          <div className="flex items-center gap-1.5 px-1 py-1">
            <input
              autoFocus
              value={nomSaisi}
              onChange={(e) => setNomSaisi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") validerNom();
                if (e.key === "Escape") setPanneau(null);
              }}
              placeholder="Ex. Épisode 4"
              aria-label="Nom du nouvel onglet"
              className="w-36 rounded-lg border border-border-strong bg-ink px-2 py-1 text-xs outline-none focus:border-coral"
            />
            <button
              type="button"
              onClick={validerNom}
              disabled={pending || !nomSaisi.trim()}
              className="rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-40"
            >
              Créer
            </button>
            <button type="button" onClick={() => setPanneau(null)} className="text-xs text-text-muted hover:text-text">
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPanneau("nouveau");
              setNomSaisi("");
              setErreur(null);
            }}
            className="rounded-t-xl border border-b-0 border-dashed border-border-strong px-3 py-2 text-xs font-medium text-text-muted hover:text-text"
          >
            ＋ Onglet
          </button>
        )}
      </nav>

      {panneau === "renommer" && (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <input
            autoFocus
            value={nomSaisi}
            onChange={(e) => setNomSaisi(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && validerNom()}
            placeholder="Nouveau nom de l'onglet"
            className="min-w-52 flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <Button type="button" onClick={validerNom} disabled={pending}>
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPanneau(null)}>
            Annuler
          </Button>
        </Card>
      )}
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un rôle"
          className="min-w-48 flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
        {ETATS.map((e) => (
          <button
            key={e.value}
            type="button"
            aria-pressed={filtre === e.value}
            onClick={() => setFiltre(filtre === e.value ? null : e.value)}
            className={cn(
              "rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors",
              filtre === e.value ? "border-text bg-text text-ink" : "border-border-strong text-text hover:border-text"
            )}
          >
            {e.label} {compteurs[e.value]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={parAction} onChange={(e) => setParAction(e.target.checked)} className="accent-coral" />
          Ce qui demande une action d&apos;abord
        </label>
        <span className="flex-1" />
        {ongletCourant && (
          <>
            <button
              type="button"
              className={boutonClair}
              onClick={() => {
                setPanneau("renommer");
                setNomSaisi(ongletCourant.nom);
                setErreur(null);
              }}
            >
              Renommer l&apos;onglet
            </button>
            <button type="button" className={boutonClair} onClick={supprimer}>
              Supprimer l&apos;onglet
            </button>
          </>
        )}
      </div>

      {visibles.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            {items.length === 0
              ? "Aucun rôle ici pour l'instant : crée-en un ou importe un fichier ci-dessous."
              : "Aucun rôle ne correspond. Change d'onglet, efface la recherche ou le filtre."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((it) => {
            const etat = ETATS.find((e) => e.value === it.etat)!;
            const o = ongletDe(it);
            return (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", it.id)}
                onClick={() => setDetail(it.id)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setDetail(it.id)}
                className="flex min-h-28 cursor-pointer flex-col items-stretch gap-2 rounded-2xl border border-border bg-ink-raised p-3 text-left transition-colors hover:border-border-strong"
              >
                <span className="flex items-center justify-between gap-2">
                  <input
                    key={`${it.id}-${it.position}`}
                    type="number"
                    min={1}
                    defaultValue={it.position}
                    title="Numéro d'ordre : change-le pour déplacer le rôle"
                    aria-label={`Numéro d'ordre de ${nomAffiche(it)}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onBlur={(e) => changerNumero(it.id, e.currentTarget.value, it.position)}
                    className="w-14 rounded-lg border-2 border-border-strong bg-ink px-2 py-0.5 text-sm font-semibold tabular-nums outline-none focus:border-coral"
                  />
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", etat.badge)}>{etat.label}</span>
                </span>
                <span className="flex-1 text-sm font-semibold leading-snug">{nomAffiche(it)}</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="flex">
                    {it.initiales.slice(0, 3).map((ini, i) => (
                      <span
                        key={i}
                        className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-raised bg-ink-raised-2 text-[10px] font-semibold first:ml-0"
                      >
                        {ini}
                      </span>
                    ))}
                    {it.nbProfils > 3 && (
                      <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-raised bg-ink-raised-2 text-[10px] font-semibold">
                        +{it.nbProfils - 3}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-text-muted">
                    {vueEffective === "all" && o ? `🗂️ ${onglets.find((x) => x.id === o)?.nom} · ` : ""}
                    {it.nbProfils > 0 ? `${it.nbProfils} profil${it.nbProfils > 1 ? "s" : ""}` : "—"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-text-muted">Glisse une carte sur un onglet pour la ranger.</p>

      <NewCastingRoleCard
        projetId={projetId}
        categorie={categorie}
        ongletId={ongletCourant?.id ?? null}
        nomOnglet={ongletCourant?.nom ?? null}
      />
    </div>
  );
}
