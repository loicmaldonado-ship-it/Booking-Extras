"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLienRapideActif } from "@/lib/casting/actions";

// Lien rapide d'un rôle : à envoyer à plusieurs personnes (SMS, réseaux…).
// Chacune se connecte ou crée son compte puis envoie ses photos / vidéos ;
// elle apparaît alors dans ce rôle.
export function LienRapideCasting({
  roleId,
  lien,
  actif,
}: {
  roleId: string;
  lien: string;
  actif: boolean;
}) {
  const router = useRouter();
  const [copie, setCopie] = useState(false);
  const [pending, demarrer] = useTransition();

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", lien);
    }
  }

  function basculer() {
    demarrer(async () => {
      await setLienRapideActif(roleId, !actif);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-ink px-3 py-2 text-sm">
      <span className="font-medium">🔗 Lien rapide du casting</span>
      {actif ? (
        <>
          <code className="min-w-0 basis-full truncate rounded-lg bg-ink-raised px-2 py-1 text-xs text-text-muted sm:basis-auto sm:flex-1">
            {lien}
          </code>
          <button
            type="button"
            onClick={copier}
            className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-ink hover:bg-coral-hover"
          >
            {copie ? "Copié !" : "Copier"}
          </button>
        </>
      ) : (
        <span className="flex-1 text-xs text-text-muted">Coupé : le lien n&apos;accepte plus personne.</span>
      )}
      <button
        type="button"
        onClick={basculer}
        disabled={pending}
        className="text-xs text-text-muted hover:text-text disabled:opacity-50"
      >
        {actif ? "Couper le lien" : "Réactiver le lien"}
      </button>
      <p className="w-full text-xs text-text-muted">
        Envoie-le à qui tu veux : chaque personne se connecte (ou crée son compte) puis envoie les photos et vidéos
        calibrées pour ce rôle — elle apparaît ici automatiquement.
      </p>
    </div>
  );
}
