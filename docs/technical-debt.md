# Dette technique, décisions et blocages

## Bloquants à la livraison production

- Docker / Supabase non disponibles dans l’environnement de travail : **aucune migration testée**.
- Installation npm impossible ici : pas de lint, typecheck ni build validés.
- 96 cartes Trello : 15 avec modifications, 2 précédemment marquées faites, les autres non clôturées ; voir `docs/trello-report.md`.
- DEC-01, DEC-02, DEC-03, DEC-04 : arbitrages et recette métier indispensables.
- RLS anciennement permissive (`authenticated full access`) sur plusieurs tables ; audit SQL nécessaire.
- Server Actions utilisant service_role : plusieurs centaines d’occurrences dans le dépôt ; sécurisation ciblée seulement.
- Validation des uploads serveur (MIME/signature magique), fusion transactionnelle, idempotence des candidatures, lien public, anonymisation, logs.
- UX/Responsive : tableaux mobiles et autres composants non retestés.
- Les nouvelles migrations devront être appliquées **avant** le code qui invoque la RPC `consume_candidate_auth_attempt`.

## Choix conscients

- Ne pas réécrire l’application existante.
- Ne pas modifier les données de production ni publier sur GitHub/Trello.
- Garder des indicateurs de validation honnêtes : un test unitaire ≠ une recette Supabase.


## Avancement du lot supplémentaire du 11/10/2026

- Préparé localement (non validé en base) : RLS casting présentiel (BUG-07), lecture des tokens (BUG-08), suppression et fusion atomiques (BUG-06, BUG-12).
- Contrôle des signatures et nettoyage de plusieurs uploads (BUG-11) : contrôles unitaires OK, tests navigateur/Storage manquants.
- Protection supplémentaire des Server Actions figurants et droits comédien (BUG-02/03) : analyse ciblée, non exhaustive.
- Mobile (BUG-17) : deux tableaux dotés d’un défilement, recette globale non faite.
- Voir `docs/reprise-lot2-2026-10-11.md`.
