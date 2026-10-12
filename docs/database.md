# Base de données

L’historique contient plus de 120 migrations SQL dans `supabase/migrations/`. L’application utilise notamment `profiles`, `projets`, `projet_membres`, `figurants`, `candidatures`, `annonces`, `bookings`, `casting_entries`, `figurant_sessions`, `figurant_auth_tokens` et les buckets de Storage.

## Nouvelles migrations locales (NON APPLIQUÉES)

1. `20261011000001_profiles_protected_columns.sql` : refuse une modification de rôle, de statut propriétaire, de pool comédien et de champs de sécurité via JWT non service_role, même si l’utilisateur peut éditer sa propre fiche par RLS.
2. `20261011000002_candidate_auth_rate_limit.sql` : ajoute un compteur global par empreinte SHA-256 de l’email sur 15 minutes, limité à 6 tentatives. La RPC est réservée au service_role. Ce n’est PAS une protection par IP ; l’anti-abus nécessite des mesures complémentaires.

## Précautions

Ne pas rejouer les migrations sur la production à ce stade. Exiger une base locale ou préproduction **isolée** et vérifier l’interaction RLS / rôle chef / assistant / compte propriétaire. Réaliser une sauvegarde et un plan d’annulation avant toute mise en production.
