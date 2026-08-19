-- Annonces: appel à candidature lié à un projet + une date, avec un lien public

create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,

  titre text not null,
  date_recherchee date,
  lieu text,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'fermée')),
  description text,

  public_token uuid not null default gen_random_uuid() unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists annonces_projet_id_idx on public.annonces (projet_id);
create index if not exists annonces_statut_idx on public.annonces (statut);
create unique index if not exists annonces_public_token_idx on public.annonces (public_token);

drop trigger if exists annonces_set_updated_at on public.annonces;
create trigger annonces_set_updated_at
  before update on public.annonces
  for each row execute function public.set_updated_at();

alter table public.annonces enable row level security;

create policy "authenticated full access" on public.annonces
  for all to authenticated using (true) with check (true);

grant all on public.annonces to service_role, authenticated;

-- Candidatures: un figurant doit postuler à chaque annonce séparément.
-- La gestion admin (tri, statut, fonction assignée) arrive avec la section
-- Candidatures ; cette table existe déjà pour que le lien public des
-- annonces ait quelque chose à écrire.

create table if not exists public.candidatures (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  annonce_id uuid not null references public.annonces (id) on delete cascade,

  statut text not null default 'en_attente' check (statut in ('en_attente', 'retenu', 'refuse')),
  fonction_assignee text,
  message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (figurant_id, annonce_id)
);

create index if not exists candidatures_annonce_id_idx on public.candidatures (annonce_id);
create index if not exists candidatures_figurant_id_idx on public.candidatures (figurant_id);
create index if not exists candidatures_statut_idx on public.candidatures (statut);

drop trigger if exists candidatures_set_updated_at on public.candidatures;
create trigger candidatures_set_updated_at
  before update on public.candidatures
  for each row execute function public.set_updated_at();

alter table public.candidatures enable row level security;

create policy "authenticated full access" on public.candidatures
  for all to authenticated using (true) with check (true);

grant all on public.candidatures to service_role, authenticated;
