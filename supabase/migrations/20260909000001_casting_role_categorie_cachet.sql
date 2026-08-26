-- Catégorie de cachet du rôle casté (role / silhouette / doublure) — sert à
-- calibrer d'un coup d'oeil ce qu'on caste, et à préremplir le cachet lors
-- du passage du profil en booking.
alter table public.casting_roles
  add column if not exists categorie_cachet text not null default 'role'
  check (categorie_cachet in ('role', 'silhouette', 'doublure'));
