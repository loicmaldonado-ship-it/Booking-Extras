# Conventions de développement et travail sans push

1. Conserver une copie intégrale du dossier et préserver `main` : ne jamais déplacer les corrections dans la production sans revue.
2. Vérifier d’abord `AGENTS.md` (Next.js 16 a des différences importantes par rapport aux versions antérieures), puis lire `node_modules/next/dist/docs/` si disponible après installation.
3. Développer une carte à la fois ou par groupe cohérent, avec fichiers et tests identifiables.
4. Garder secrets dans `.env.local` (ignoré par Git), jamais dans l’archive ou le code source.
5. Pour la base, créer une migration nouvelle, ne pas modifier les migrations déployées.
6. `npm test` pour les tests unitaires sans services, `npm run lint`, `npm run typecheck`, `npm run build` pour la qualité après installation.
7. Pas d’écriture GitHub, Trello, Vercel, Supabase à partir de cette mission. Le rapport est conservé dans `docs/trello-report.md`.

Le code remis est à intégrer **par une personne autorisée**, seulement après tests.
