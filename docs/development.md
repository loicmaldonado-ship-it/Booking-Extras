# Conventions de développement et travail sans push

1. Conserver une copie intégrale du dossier et préserver `main` : ne jamais déplacer les corrections dans la production sans revue.
2. Vérifier d’abord `AGENTS.md` (Next.js 16 a des différences importantes par rapport aux versions antérieures), puis lire `node_modules/next/dist/docs/` si disponible après installation.
3. Développer une carte à la fois ou par groupe cohérent, avec fichiers et tests identifiables.
4. Garder secrets dans `.env.local` (ignoré par Git), jamais dans l’archive ou le code source.
5. Pour la base, créer une migration nouvelle, ne pas modifier les migrations déployées.
6. `npm test` pour les tests unitaires sans services, `npm run lint`, `npm run typecheck`, `npm run build` pour la qualité après installation.
7. Pour cette reprise, utiliser exclusivement la branche `tests/integration-main-elea-2026-10-22` et consigner les résultats dans `WORK_PROGRESS.md`. Une carte Trello peut être cochée après validation technique complète ; la recette métier est suivie séparément. Ne pas déployer, fusionner ni réinitialiser une base. La synchronisation GitHub peut nécessiter une authentification distincte.

Le code remis est à intégrer **par une personne autorisée**, seulement après tests.
