# Architecture — Booking Extras

- **Frontend et serveur** : Next.js 16.3.0 App Router, React 19.2.8, TypeScript ; Tailwind CSS 4.
- **Base et Auth équipe** : Supabase PostgreSQL, Supabase Auth ; clients SSR et service_role (`src/lib/supabase/`).
- **Compte candidat** : mots de passe `scrypt`, cookies `figurant_session`, table `figurant_sessions`, tokens temporaires ; ne pas confondre avec Supabase Auth équipe.
- **Migrations** : `supabase/migrations/`, versionnées et ordonnées.
- **Fichiers privés** : Supabase Storage, vidéos/photos casting, signatures, liens partagés ; ne jamais traiter un chemin remis par le navigateur comme une autorisation.
- **Fonctions métier** : `src/lib/{projets,annonces,candidatures,bookings,casting,essayages,figurants,equipe,...}` ; pages et composants regroupés par domaine.
- **Déploiement** : Vercel, branche `main` décrite comme version de production dans la passation.

**Important :** architecture décrite depuis l’archive du commit `f5cbbf2` du 08/10/2026 ; aucune base Supabase réelle n’a été interrogée ici.
