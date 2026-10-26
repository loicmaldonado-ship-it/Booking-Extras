> **Note historique.** Pour les corrections et preuves réellement vérifiées le 26 octobre, voir [le bilan actuel](bilan-trello-2026-10-26.md) et [les droits Supabase du 30 octobre](supabase-30-octobre-2026.md). La liste ci-dessous contient aussi des constats antérieurs désormais corrigés et ne constitue pas un audit final.

# Sécurité — mesures et limites

## Mesures ajoutées localement

- Suppression du cache de pages privées par le Service Worker, conservation d’un unique `public/offline.html` **statique** et purge des anciens caches de l’application.
- Redirections après connexion limitées aux chemins internes, y compris après normalisation d’URL (`next`).
- Revérification de `acces_compte` pour chaque session candidate et lors du rachat d’un lien magique ; consommations de jetons sous condition atomique.
- Effacement des sessions et des liens d’activation lors de la révocation ; vérification des erreurs de base sur ces mutations.
- Garde-fou SQL contre l’élévation de rôle sur `public.profiles`.
- Compteur centralisé anti-abus sur connexions candidates et réponses homogènes lors de demande de lien.
- Vérification d’une session staff pour des Server Actions auparavant exposées sans garde.
- Validation des chemins Storage des self-tapes, de l’existence réelle des objets et blocage après soumission.

## Risques / validations encore obligatoires

- Audit **exhaustif** des exports `"use server"` et appels `createAdminClient()` restants (plusieurs centaines d’occurrences dans le projet).
- Revue RLS complète sur les ~120 migrations historiques, dont les politiques `authenticated full access` restantes.
- Matrice métier des droits DEC-02 non validée (cheffe, propriétaire, assistante et pool comédien).
- Concurrence des écritures lors de la finalisation d’une candidature/casting et suppression de médias en cas d’échec partiel.
- Rate limiting multi-dimensionnel (IP, réseau, compte), campagnes d’emails, attaques de compte existant/non existant.
- Vérification de MIME réel, signature magique, poids et dimensions des images **côté serveur**.
- Vérification des tokens publics, révocations de liens et droits d’export.
- Tests de sécurité réels Supabase multi-comptes, Playwright et audit de dépendances.

**Cette archive n’est pas une attestation d’absence de vulnérabilités.**

Voir `security-audit-snapshot.md` pour l'inventaire statique de 27 anciennes policies permissives et 39 modules Server Actions avec accès service_role. Une policy historique peut être révoquée par une migration ultérieure.
