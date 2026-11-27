-- Onglets de casting : des regroupements de rôles que la cheffe crée et nomme
-- elle-même (« Épisode 1 », « Session 2 »…), propres à chaque projet. Un rôle
-- est dans un seul onglet à la fois, ou dans aucun. Supprimer un onglet ne
-- supprime pas ses rôles : ils repassent « sans onglet ».
create table public.casting_onglets (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  nom text not null check (length(btrim(nom)) > 0),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  unique (projet_id, nom)
);

create index casting_onglets_projet_id_idx on public.casting_onglets (projet_id);

alter table public.casting_onglets enable row level security;
create policy "scoped by projet" on public.casting_onglets for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
grant all on public.casting_onglets to service_role, authenticated;

alter table public.casting_roles
  add column if not exists onglet_id uuid references public.casting_onglets (id) on delete set null;

create index if not exists casting_roles_onglet_id_idx on public.casting_roles (onglet_id);
