# Changements locaux — 11 octobre 2026

Base : archive `Booking-Extras-main`, commit `f5cbbf2` (08/10/2026).

**Aucun push GitHub, aucune écriture Trello, aucune mise en production.**

## Corrections techniques intégrées dans l’archive

- **BUG-05** : Service Worker cache uniquement le secours statique `/offline.html` ; purge anciens caches sensibles et aucune page privée mise en cache.
- **BUG-10** : blocage des redirections `next` externes, y compris protocole relatif et normalisation de chemin.
- **BUG-04 / SEC-02** : révocation des sessions et tokens ; revalidation des droits de compte candidat à chaque lecture ; vérification atomique du lien de connexion ; destruction de la session en déconnexion.
- **BUG-01** : nouvelle migration SQL interdisant la modification du rôle, du statut propriétaire et d’autres colonnes sensibles depuis une session utilisateur ordinaire.
- **BUG-09** : compteur partagé Supabase par empreinte de l’adresse, réponse uniforme aux demandes de lien ; test de charge/abuse encore requis.
- **BUG-02** : fonctions sensibles d’envoi d’email retirées des Server Actions exposées, gardes supplémentaires sur lecture de fiches, modèles, email candidature, suppression dates/questions.
- **BUG-13** : traitement de plusieurs erreurs SQL auparavant ignorées ; contrôle encore incomplet sur le dépôt.
- **BUG-14 / BUG-15** : verrouillage de self-tapes soumis et contrôle des chemins Storage et existence des objets avant finalisation.
- **BUG-16** : reformulation de l’email d’accès afin de ne pas annoncer à tort une date de tournage.
- **BUG-18** : zone d’upload casting clavier-accessible, libellé ARIA, nettoyage de l’URL de prévisualisation.
- **BUG-06 / BUG-12** : confirmation renforcée de suppression, RPC PostgreSQL atomiques de suppression et fusion, refus des pertes d'historique et des conflits.
- **BUG-07 / BUG-08** : RLS du casting présentiel par projet et contrôles d'accès des getters de tokens de partage.
- **BUG-11 / BUG-17** : signatures binaires de fichiers, nettoyage Storage sur erreurs DB, vues tableau candidats et profils défilantes sur mobile.
- **BUG-02 / BUG-03** : contrôles staff et vivier comédien supplémentaires sur les Server Actions figurants.
- **BUG-06 / BUG-12** : confirmation renforcée de suppression, RPC PostgreSQL atomiques de suppression et fusion, refus des pertes d'historique et des conflits.
- **BUG-07 / BUG-08** : RLS du casting présentiel par projet et contrôles d'accès des getters de tokens de partage.
- **BUG-11 / BUG-17** : signatures binaires de fichiers, nettoyage Storage sur erreurs DB, vues tableau candidats et profils défilantes sur mobile.
- **BUG-02 / BUG-03** : contrôles staff et vivier comédien supplémentaires sur les Server Actions figurants.
- **QA-04 / QA-05 / ENV-06** : tests Node, workflow CI PR et documentation développeur.

## Preuves locales disponibles

- `npm test` : **24/24 succès** sur les tests Node fournis.
- Analyse syntaxique TypeScript des fichiers modifiés : aucune erreur de syntaxe détectée.
- L’installation des dépendances est bloquée (`npm ci --offline` => `ENOTCACHED`) ; aucune vérification de lint, types complets, build, SQL RLS, navigateur ou préproduction effectuée.

## Limites importantes

**Il ne s’agit pas de l’exécution intégrale des 96 cartes ni d’une application certifiée pour la production.** Les cartes sont inventoriées dans `docs/trello-report.md`, et les validations/risques sont décrits dans `docs/technical-debt.md`. Les migrations doivent être appliquées à une base isolée avant tout essai des nouvelles fonctions candidates.


## Reprise locale supplémentaire

Voir `docs/reprise-lot2-2026-10-11.md` : 24/24 tests unitaires/statiques et nouvelles migrations à tester en base avant toute utilisation. Les 96 cartes ne sont pas terminées.


## Reprise locale supplémentaire

Voir `docs/reprise-lot2-2026-10-11.md` : 24/24 tests unitaires/statiques et nouvelles migrations à tester en base avant toute utilisation. Les 96 cartes ne sont pas terminées.
