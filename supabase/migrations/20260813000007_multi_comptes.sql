-- Fondations multi-comptes (agence) : plusieurs chefs de casting partagent la
-- base Figurants, mais ont des Projets (et tout ce qui en dépend : Annonces,
-- Candidatures, Bookings, Essayages) privés par défaut, avec partage explicite
-- possible. On pose le schéma maintenant pour éviter un retrofit plus tard.
--
-- L'authentification réelle (connexion, sessions) et les policies RLS
-- restrictives par propriétaire arrivent avec la section dédiée Auth & Rôles :
-- sans flux de connexion pour les tester, les activer maintenant serait du
-- code mort et invérifiable. Pour l'instant les policies "authenticated full
-- access" existantes restent en place.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text,
  role text not null default 'assistant' check (role in ('assistant', 'collaborateur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "authenticated full access" on public.profiles
  for all to authenticated using (true) with check (true);
grant all on public.profiles to service_role, authenticated;

-- Chaque projet appartient à un chef de casting (nullable tant que
-- l'authentification n'est pas branchée).
alter table public.projets
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

create index if not exists projets_owner_id_idx on public.projets (owner_id);

-- Partage explicite d'un projet avec d'autres chefs de casting.
create table if not exists public.projet_membres (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (projet_id, profile_id)
);

create index if not exists projet_membres_projet_id_idx on public.projet_membres (projet_id);
create index if not exists projet_membres_profile_id_idx on public.projet_membres (profile_id);

alter table public.projet_membres enable row level security;
create policy "authenticated full access" on public.projet_membres
  for all to authenticated using (true) with check (true);
grant all on public.projet_membres to service_role, authenticated;
