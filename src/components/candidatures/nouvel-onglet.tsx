"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCandidatureOnglet } from "@/lib/candidatures/actions";

// « ＋ Onglet » au bout du classeur : crée un onglet propre à cette annonce
// et l'ouvre.
export function NouvelOnglet({ annonceId, hrefOnglet }: { annonceId: string; hrefOnglet: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function creer() {
    if (!nom.trim()) return;
    setErreur(null);
    startTransition(async () => {
      const res = await createCandidatureOnglet(nom.trim(), annonceId);
      if (res?.error) {
        setErreur(res.error);
        return;
      }
      setOuvert(false);
      setNom("");
      if (res?.onglet) router.push(hrefOnglet.replace("__ONGLET__", res.onglet.id), { scroll: false });
      else router.refresh();
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-t-xl border border-b-0 border-dashed border-border-strong px-3 py-2 text-xs font-medium text-text-muted hover:text-text"
      >
        ＋ Onglet
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <input
        autoFocus
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") creer();
          if (e.key === "Escape") setOuvert(false);
        }}
        placeholder="Ex. Silhouettes"
        aria-label="Nom du nouvel onglet"
        className="w-36 rounded-lg border border-border-strong bg-ink px-2 py-1 text-xs outline-none focus:border-coral"
      />
      <button
        type="button"
        onClick={creer}
        disabled={pending || !nom.trim()}
        className="rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-40"
      >
        Créer
      </button>
      <button type="button" onClick={() => setOuvert(false)} className="text-xs text-text-muted hover:text-text">
        Annuler
      </button>
      {erreur && <span className="text-xs text-danger">{erreur}</span>}
    </div>
  );
}
