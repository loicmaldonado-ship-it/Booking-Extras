-- Mode par profil (pas seulement par rôle) : au sein d'un même rôle,
-- certain·es profils peuvent finalement passer en présentiel et d'autres
-- rester en selftape — bouton dédié sur chaque carte pour basculer vite,
-- indépendamment du mode par défaut du rôle. Hérite du mode du rôle à la
-- création (mis à jour par l'application, pas par un default SQL dynamique).
alter table public.casting_entries add column if not exists mode text not null default 'selftape'
  check (mode in ('presentiel', 'selftape'));
