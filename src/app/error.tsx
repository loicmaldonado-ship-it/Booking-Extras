"use client";

import Link from "next/link";
import { useEffect } from "react";
import { nettoyerChemin, nettoyerTexte } from "@/lib/observabilite/rapport-erreur";

// Revue du 30/10/2026 : sans cette page, une erreur levée par une action ou un rendu affichait en production l'écran
// générique « Application error ». Ici : un message compréhensible, un bouton pour réessayer, la référence d'erreur à
// transmettre, et un signalement nettoyé dans le journal (QA-08, « [booking-error] »).
export default function ErreurPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  useEffect(() => {
    try {
      const corps = JSON.stringify({
        type: nettoyerTexte(error instanceof Error ? error.name : "Erreur", 60),
        message: nettoyerTexte(`${error instanceof Error ? error.message : String(error)}${digest ? ` (digest ${digest})` : ""}`),
        pile: nettoyerTexte(error instanceof Error ? error.stack : "", 3000),
        route: nettoyerChemin(window.location.pathname),
      });
      navigator.sendBeacon?.("/api/erreurs-client", new Blob([corps], { type: "application/json" }));
    } catch {
      // jamais bloquant
    }
  }, [error, digest]);

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="text-text-muted">
        L&apos;action n&apos;a pas pu aboutir. Rien n&apos;a été confirmé : réessaie, et si le problème continue, signale-le
        avec la référence ci-dessous.
      </p>
      {digest && <p className="text-xs text-text-muted">Référence : {digest}</p>}
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-xl bg-coral px-4 py-2 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Réessayer
        </button>
        <Link href="/" className="rounded-xl border border-border px-4 py-2 text-sm">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
