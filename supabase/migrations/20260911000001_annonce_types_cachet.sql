-- Type(s) de profil recherché par l'annonce (Figurant / Silhouette /
-- Silhouette parlante / Doublure simple / Doublure polyvalente / Rôle) —
-- affiché sur la page candidat pour qu'on sache d'emblée ce qui est
-- recherché, calibrable depuis le formulaire d'annonce.
alter table public.annonces add column if not exists types_cachet text[] not null default '{}';
