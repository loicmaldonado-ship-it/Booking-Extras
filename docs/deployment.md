# Déploiement / retour arrière — préparation, NON EXÉCUTÉ

**Aucune opération de production n’a été effectuée.**

1. Environnement de développement isolé : `npm ci`, `npx supabase start`, `.env.local` avec secrets locaux, `npx supabase db reset` (ATTENTION : commande destructive réservée au local).
2. Rejouer les **nouvelles** migrations sur préproduction et vérifier les politiques de sécurité existantes, comptes et sessions.
3. Tests : `npm test`, lint, typecheck, build, scénarios multi-comptes, tests média sur Safari iOS et Chrome.
4. Vérifier chaque changement SQL, le plan de sauvegarde Supabase et une stratégie de retour arrière compatible avec les nouvelles fonctions/tables.
5. Revue de code humaine, confirmation DEC-01/DEC-02/DEC-03 et recette métier DEC-04.
6. À **approuver explicitement** plus tard : éventuelle branche de travail, PR vers main et déploiement Vercel. Ne pas exécuter automatiquement.
7. Smoke test de production seulement après déploiement approuvé, puis surveillance logs.

Un rollback du code ne retire pas automatiquement une migration de base. Planifier une migration corrective/annulation non destructive si nécessaire.
