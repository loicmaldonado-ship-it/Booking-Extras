-- Essayages : rendez-vous costume, séparés du jour de tournage.

create table if not exists public.essayages (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity,

  figurant_id uuid not null references public.figurants (id) on delete cascade,
  projet_id uuid not null references public.projets (id) on delete cascade,

  date date,
  heure time,
  lieu text,
  statut text not null default 'proposé' check (statut in ('proposé', 'confirmé', 'fait')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists essayages_figurant_id_idx on public.essayages (figurant_id);
create index if not exists essayages_projet_id_idx on public.essayages (projet_id);
create index if not exists essayages_date_idx on public.essayages (date);
create index if not exists essayages_statut_idx on public.essayages (statut);

drop trigger if exists essayages_set_updated_at on public.essayages;
create trigger essayages_set_updated_at
  before update on public.essayages
  for each row execute function public.set_updated_at();

alter table public.essayages enable row level security;

create policy "authenticated full access" on public.essayages
  for all to authenticated using (true) with check (true);

grant all on public.essayages to service_role, authenticated;
