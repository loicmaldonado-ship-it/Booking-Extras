-- Liens de partage publics, en lecture seule, par projet : un lien pour les
-- documents (trombis + fiches mensuration rangés par date) et un lien pour
-- le planning des essayages, destinés aux autres départements / costumières.

create table if not exists public.partage_liens (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  type text not null check (type in ('documents', 'essayages')),
  token text not null unique,
  created_at timestamptz not null default now(),
  unique (projet_id, type)
);

create index if not exists partage_liens_projet_id_idx on public.partage_liens (projet_id);

alter table public.partage_liens enable row level security;

drop policy if exists "scoped by projet" on public.partage_liens;
create policy "scoped by projet" on public.partage_liens for all to authenticated
  using (public.has_projet_access(projet_id))
  with check (public.has_projet_access(projet_id));

grant all on public.partage_liens to service_role, authenticated;
