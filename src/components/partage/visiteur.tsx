"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n/partage";
import { ROLES, ts } from "@/lib/i18n/suivi";

// Identité d'une personne qui ouvre un lien de partage (réal, MES, prod…) :
// prénom + rôle demandés une seule fois sur l'appareil, communs à tous les
// liens, avec un identifiant aléatoire. Rien n'est demandé d'autre.

export type Visiteur = { id: string; prenom: string; role: string };

const CLE = "be-visiteur-partage";

let memoire: string | null = null;
const abonnes = new Set<() => void>();

function lire() {
  try {
    return localStorage.getItem(CLE) ?? memoire;
  } catch {
    return memoire;
  }
}

function abonner(cb: () => void) {
  abonnes.add(cb);
  return () => {
    abonnes.delete(cb);
  };
}

export function enregistrerVisiteur(v: Visiteur) {
  const brut = JSON.stringify(v);
  memoire = brut;
  try {
    localStorage.setItem(CLE, brut);
  } catch {
    // Navigation privée : l'identité ne tient que le temps de la page.
  }
  abonnes.forEach((cb) => cb());
}

// « Ce n'est pas moi » : oublie le prénom et le rôle sur cet appareil.
export function oublierVisiteur() {
  memoire = null;
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Rien à effacer.
  }
  abonnes.forEach((cb) => cb());
}

export function useVisiteur(): Visiteur | null {
  const brut = useSyncExternalStore(abonner, lire, () => null);
  return useMemo(() => {
    try {
      const v = brut ? (JSON.parse(brut) as Visiteur) : null;
      return v?.id && v.prenom ? v : null;
    } catch {
      return null;
    }
  }, [brut]);
}

// Prénom et rôle : en fenêtre à l'arrivée, ou dans la page (inline) au
// moment d'écrire un commentaire.
// `focus` : place le curseur dans le prénom (clavier ouvert sur téléphone) ; faux quand
// le formulaire est simplement affiché au milieu d'une fenêtre.
export function AccueilVisiteur({ inline = false, lang = "fr", focus = !inline }: { inline?: boolean; lang?: Lang; focus?: boolean }) {
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState(ROLES[lang][0]);

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim()) return;
    enregistrerVisiteur({ id: crypto.randomUUID(), prenom: prenom.trim().slice(0, 60), role });
  }

  const formulaire = (
      <form
        onSubmit={valider}
        className={
          inline
            ? "flex flex-col gap-3 rounded-xl border border-border bg-ink p-3"
            : "flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-5"
        }
      >
        {!inline && <h2 className="text-xl font-semibold">{ts(lang, "bonjour")}</h2>}
        <p className="text-sm text-text-muted">
          {ts(lang, inline ? "avant_ecrire" : "pourquoi")}
        </p>
        <label className="flex flex-col gap-1 text-sm">
          {ts(lang, "votre_prenom")}
          <input
            autoFocus={focus}
            required
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            maxLength={60}
            className="rounded-lg border border-border-strong bg-ink px-3 py-2 outline-none focus:border-coral"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {ts(lang, "votre_role")}
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-border-strong bg-ink px-3 py-2">
            {ROLES[lang].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-coral px-4 py-2.5 font-semibold text-ink hover:bg-coral-hover">
          {ts(lang, "continuer")}
        </button>
        <span className="text-xs text-text-muted">{ts(lang, "une_fois")}</span>
      </form>
  );
  if (inline) return formulaire;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={ts(lang, "votre_prenom")}
    >
      {formulaire}
    </div>
  );
}
