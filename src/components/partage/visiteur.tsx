"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

// Identité d'une personne qui ouvre un lien de partage (réal, MES, prod…) :
// prénom + rôle demandés une seule fois sur l'appareil, communs à tous les
// liens, avec un identifiant aléatoire. Rien n'est demandé d'autre.

export type Visiteur = { id: string; prenom: string; role: string };

const CLE = "be-visiteur-partage";
export const ROLES_VISITEUR = ["Réalisation", "Mise en scène", "1er assistant·e", "Production", "Costumes", "Autre"];

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

// Fenêtre d'arrivée : prénom et rôle.
export function AccueilVisiteur() {
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState(ROLES_VISITEUR[0]);

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim()) return;
    enregistrerVisiteur({ id: crypto.randomUUID(), prenom: prenom.trim().slice(0, 60), role });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/70 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Qui êtes-vous ?"
    >
      <form onSubmit={valider} className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-5">
        <h2 className="text-xl font-semibold">Bonjour 👋</h2>
        <p className="text-sm text-text-muted">Pour que l&apos;équipe casting sache qui consulte et qui commente :</p>
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
            {ROLES_VISITEUR.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-coral px-4 py-2.5 font-semibold text-ink hover:bg-coral-hover">
          Continuer
        </button>
        <span className="text-xs text-text-muted">Demandé une seule fois sur cet appareil.</span>
      </form>
    </div>
  );
}
