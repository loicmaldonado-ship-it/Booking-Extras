-- Casting en présentiel : planning de journées d'audition en personne,
-- même mécanique que les journées d'essayage (journée -> créneaux ->
-- profils assignés), mais sans lien de partage équipe — juste un planning
-- interne et son export PDF.

create table if not exists public.casting_presentiel_journees (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  date date not null,
  lieu text,
  created_at timestamptz not null default now(),
  unique (projet_id, date)
);

create index if not exists casting_presentiel_journees_projet_id_idx on public.casting_presentiel_journees (projet_id);

alter table public.casting_presentiel_journees enable row level security;

create policy "scoped by projet" on public.casting_presentiel_journees for all to authenticated
  using (public.has_projet_access(projet_id))
  with check (public.has_projet_access(projet_id));

grant all on public.casting_presentiel_journees to service_role, authenticated;

create table if not exists public.casting_presentiel_creneaux (
  id uuid primary key default gen_random_uuid(),
  journee_id uuid not null references public.casting_presentiel_journees (id) on delete cascade,
  heure_debut time not null,
  heure_fin time not null,
  capacite integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists casting_presentiel_creneaux_journee_id_idx on public.casting_presentiel_creneaux (journee_id);

alter table public.casting_presentiel_creneaux enable row level security;

create policy "authenticated full access" on public.casting_presentiel_creneaux
  for all to authenticated using (true) with check (true);

grant all on public.casting_presentiel_creneaux to service_role, authenticated;

create table if not exists public.casting_presentiel_entries (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  journee_id uuid not null references public.casting_presentiel_journees (id) on delete cascade,
  creneau_id uuid references public.casting_presentiel_creneaux (id) on delete set null,
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  role_id uuid references public.casting_roles (id) on delete set null,
  statut text not null default 'proposé'
    check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'attente_validation', 'valide', 'confirmé', 'indisponible', 'annulé')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journee_id, figurant_id)
);

create index if not exists casting_presentiel_entries_journee_id_idx on public.casting_presentiel_entries (journee_id);
create index if not exists casting_presentiel_entries_figurant_id_idx on public.casting_presentiel_entries (figurant_id);
create index if not exists casting_presentiel_entries_projet_id_idx on public.casting_presentiel_entries (projet_id);

drop trigger if exists casting_presentiel_entries_set_updated_at on public.casting_presentiel_entries;
create trigger casting_presentiel_entries_set_updated_at
  before update on public.casting_presentiel_entries
  for each row execute function public.set_updated_at();

alter table public.casting_presentiel_entries enable row level security;

create policy "authenticated full access" on public.casting_presentiel_entries
  for all to authenticated using (true) with check (true);

grant all on public.casting_presentiel_entries to service_role, authenticated;
