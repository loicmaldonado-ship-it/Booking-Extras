import type { Instrumentation } from "next";
import { construireRapport, ecrireRapport } from "@/lib/observabilite/rapport-erreur";

// QA-08 : toute erreur serveur capturée par Next (rendu, route, action, proxy) → une ligne JSON « [booking-error] »
// dans les journaux, sans corps, cookies ni en-têtes (seule la famille de navigateur est gardée).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const ua = request.headers["user-agent"];
    ecrireRapport(
      construireRapport({
        source: "serveur",
        erreur: err,
        chemin: request.path,
        methode: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
        userAgent: Array.isArray(ua) ? ua[0] : ua,
      })
    );
  } catch {
    // Le suivi ne doit jamais provoquer d'erreur lui-même.
  }
};
