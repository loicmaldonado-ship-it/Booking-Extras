# Booking Extras — méthode Git de l'équipe (`ENV-07`)

## Règle de la mission en cours — 26 octobre 2026

L’instruction actuelle d’Éléa prime sur le workflow général ci-dessous : seul le dépôt de tests et la branche `tests/integration-main-elea-2026-10-22` sont modifiés. Commits locaux autorisés ; aucun push, aucune modification de `main` ou `elea`, aucun déploiement. Préserver les changements préexistants, vérifier les ancêtres intégrés et les destinations de base avant toute écriture. Les migrations neuves et les tests utilisent uniquement les piles locales isolées.

Le workflow général suivant concerne une reprise ultérieure autorisée par l’équipe ; il n’autorise pas de PR/push vers elea ou main pendant cette mission.

`main` est la branche de production. **Aucun correctif n'est poussé directement vers `main`** lors de la reprise. `elea` est la branche d'intégration et de validation technique. Une carte assez large peut être développée sur `feat/CAN-05-description` ou `fix/BUG-02-description`, toujours créée **à partir de `elea`**, puis proposée en PR vers `elea`.

## Pour chaque carte Trello

1. Vérifier l'ID, le titre exact, le résultat attendu et ses dépendances. Une fonctionnalité présente ne suffit pas à la clore.
2. Vérifier `git status -sb` et la tête distante de `elea`. Ne pas écraser ni mettre de côté silencieusement des changements locaux.
3. Utiliser des commits incluant le contexte : `feat(CAN-05): ...`, `fix(BUG-02): ...`, `test(QA-04): ...`.
4. Ajouter un test négatif pour les limites, accès et erreurs ; conserver les tests déjà validés sauf régression touchant leur zone.
5. Pour les données : migration SQL **nouvelle**, datée et relue ; jamais d'édition d'une migration déjà déployée. Ne pas exécuter `db reset` sur une base à conserver. Toujours vérifier la destination et une sauvegarde avant toute mutation.
6. Ne pas committer `.env.local`, tokens, mots de passe, clés de production, données personnelles, exports réels ou médias privés.
7. Dans la PR : carte(s), périmètre, fichiers, captures si interface, tests **effectivement exécutés** (et non exécutés), risques et plan de retour arrière.
8. Faire valider la PR vers `elea`. Seule une décision explicite de l'équipe autorise le passage `elea` → `main` / production.

## Vérifications techniques recommandées

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Les tests avec base locale doivent utiliser **uniquement** les clés et URL Supabase locales, dans un environnement dont les ports sont limités à localhost. CI GitHub : tests/lint/typecheck/build automatiques, sans secrets de production. La CI ne remplace pas la recette avec deux équipes distinctes, ni les tests de persistance.

## Statuts à reporter manuellement dans Trello

- **Terminée et vérifiée** : code intégré + critères d'acceptation confirmés avec preuves/tests.
- **Partiellement réalisée** : code présent ou tests incomplets ; préciser le reste.
- **À faire** : pas encore réalisé.
- **Bloquée** : dépendance, accès ou décision métier indispensable, avec cause explicite.

Ne pas modifier le tableau automatiquement : l'équipe reporte les statuts après revue.
