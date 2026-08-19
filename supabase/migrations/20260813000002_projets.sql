-- Projets

create table if not exists public.projets (
  id uuid primary key default gen_random_uuid(),

  nom text not null,
  type text check (type in ('Film', 'Série', 'Publicité', 'Clip', 'Autre')),
  realisateur text,
  societe_production text,
  diffuseur text,
  confidentiel boolean not null default false,

  date_debut date,
  date_fin date,
  lieu text,

  contact_nom text,
  contact_telephone text,
  contact_email text,

  besoins_figuration text,
  synopsis text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projets_nom_idx on public.projets (nom);
create index if not exists projets_type_idx on public.projets (type);
create index if not exists projets_dates_idx on public.projets (date_debut, date_fin);

drop trigger if exists projets_set_updated_at on public.projets;
create trigger projets_set_updated_at
  before update on public.projets
  for each row execute function public.set_updated_at();

alter table public.projets enable row level security;

create policy "authenticated full access" on public.projets
  for all to authenticated using (true) with check (true);

grant all on public.projets to service_role, authenticated;
