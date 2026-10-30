// QA-08 : erreurs JavaScript non gérées dans le navigateur → /api/erreurs-client (journal serveur « [booking-error] »).
// Nettoyées ici ET côté serveur ; au plus 5 envois par page chargée ; jamais bloquant.
import { nettoyerChemin, nettoyerTexte } from "@/lib/observabilite/rapport-erreur";

let envoyes = 0;

function signaler(type: unknown, message: unknown, pile: unknown) {
  try {
    if (envoyes >= 5 || typeof navigator === "undefined") return;
    envoyes += 1;
    const corps = JSON.stringify({
      type: nettoyerTexte(type, 60),
      message: nettoyerTexte(message),
      pile: nettoyerTexte(pile, 3000),
      route: nettoyerChemin(window.location.pathname),
    });
    const blob = new Blob([corps], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/erreurs-client", blob)) {
      void fetch("/api/erreurs-client", { method: "POST", body: corps, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // jamais bloquant
  }
}

window.addEventListener("error", (event) => {
  const e = event.error as { name?: string; stack?: string } | undefined;
  signaler(e?.name ?? "Error", event.message, e?.stack ?? `${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener("unhandledrejection", (event) => {
  const r = event.reason as { name?: string; message?: string; stack?: string } | undefined;
  signaler(r?.name ?? "UnhandledRejection", r?.message ?? r, r?.stack ?? "");
});
