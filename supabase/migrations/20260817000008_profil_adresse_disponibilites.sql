-- Adresse complète + option logement, et retrait de "commune de naissance"
-- du formulaire (colonne conservée pour les fiches déjà remplies, juste
-- plus collectée).
alter table public.figurants add column if not exists adresse text;
alter table public.figurants add column if not exists logement_france text;

-- Lien public secret par fiche, pour que le candidat déclare ses
-- indisponibilités sans avoir de compte.
alter table public.figurants add column if not exists token_disponibilite uuid not null default gen_random_uuid();
create unique index if not exists figurants_token_disponibilite_idx on public.figurants (token_disponibilite);

create table if not exists public.figurant_indisponibilites (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (figurant_id, date)
);

create index if not exists figurant_indispo_figurant_id_idx on public.figurant_indisponibilites (figurant_id);

alter table public.figurant_indisponibilites enable row level security;

create policy "authenticated full access" on public.figurant_indisponibilites
  for all to authenticated using (true) with check (true);

grant all on public.figurant_indisponibilites to service_role, authenticated;
