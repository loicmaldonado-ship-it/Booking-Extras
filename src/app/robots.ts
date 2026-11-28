import type { MetadataRoute } from "next";

// Lighthouse (30/10/2026) : /robots.txt renvoyait une page HTML. Seules les pages publiques (accueil, annonces,
// inscription) sont indexables ; l'outil d'équipe et tous les liens à jeton (partage, dépôt, reçus, mineurs…) sont
// exclus. Ces pages envoient aussi un en-tête noindex (next.config.ts) : robots.txt n'est pas une protection d'accès.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/annonces/", "/postuler", "/confidentialite", "/login"],
      disallow: [
        "/api/", "/auth/", "/partage/", "/casting/", "/disponibilites/", "/recu/", "/compte", "/mon-compte", "/mineurs",
        "/admin", "/aide", "/equipe", "/essayages", "/modeles", "/rgpd", "/projets", "/bookings", "/figurants",
        "/candidatures", "/bareme",
      ],
    },
  };
}
