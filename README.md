# Booking Extras — reprise locale de développement

Application de casting et gestion de figurant·es (projets, annonces, candidatures, bookings, essayages, casting, médias, notifications, exports). Stack : Next.js 16.3.0, React 19.2.8, TypeScript, Supabase/PostgreSQL et Vercel.

> **Attention : cette archive est une proposition locale de correctifs, pas une version certifiée ou déployable en l’état.** Aucun push GitHub, aucune écriture Trello et aucune modification de production n’ont été effectués.

## Démarrage

- Installer Node.js 22, Docker Desktop et le CLI Supabase. Lire `AGENTS.md` ; après `npm ci`, consulter la documentation Next.js de la version installée dans `node_modules/next/dist/docs/`.
- `npm ci`
- `npx supabase start`
- `cp .env.example .env.local`, récupérer les clés **locales** avec `npx supabase status -o env`, renseigner `.env.local` (ne pas utiliser les secrets de production).
- `npx supabase db reset` (**local uniquement** ; efface les données locales et rejoue les migrations/seed).
- `npm run dev` ; ouvrir <http://localhost:3000>.

## Contrôles avant toute PR

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Les 24 tests Node fournis ont réussi dans l’environnement de préparation ; `npm ci` et les autres vérifications ont été bloqués par l’absence de dépendances complètes. Les migrations SQL n’ont PAS été exécutées faute de Docker.

## Parcours du code

- `src/app/` : pages Next.js
- `src/components/` : UI
- `src/lib/` : auth, sessions candidates, logique métier, Supabase, casting, uploads
- `supabase/migrations/` : migrations Postgres / RLS
- `public/sw.js` et `public/offline.html` : Service Worker, secours hors ligne statique et non sensible
- `tests/` : tests unitaires Node
- `docs/trello-report.md` : inventaire 96 cartes et statut réel du travail local

## Documentation détaillée

Lire `README_Booking_Extras.md` pour la passation historique et `docs/{architecture,database,security,development,testing,deployment,recette,trello-report,technical-debt}.md` pour la reprise actuelle.

**Précaution :** ne jamais travailler directement sur `main` ni appliquer les nouvelles migrations sur la production sans préproduction, tests, sauvegarde et décision explicite.
