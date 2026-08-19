-- Planning d'essayage par journée, parallèle au booking : une "journée
-- d'essayage" a une date et un lieu, et les essayages existants s'y
-- rattachent (nullable pour ne pas casser les essayages déjà créés hors
-- planning).

create table if not exists public.essayage_journees (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  date date not null,
  lieu text,
  created_at timestamptz not null default now(),
  unique (projet_id, date)
);

create index if not exists essayage_journees_projet_id_idx on public.essayage_journees (projet_id);

alter table public.essayages add column if not exists essayage_journee_id uuid references public.essayage_journees (id) on delete set null;

alter table public.essayage_journees enable row level security;

drop policy if exists "scoped by projet" on public.essayage_journees;
create policy "scoped by projet" on public.essayage_journees for all to authenticated
  using (public.has_projet_access(projet_id))
  with check (public.has_projet_access(projet_id));

grant all on public.essayage_journees to service_role, authenticated;
