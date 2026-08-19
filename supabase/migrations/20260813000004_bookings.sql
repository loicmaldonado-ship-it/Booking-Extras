-- Bookings: une journée de tournage pour un figurant.
-- Créée ici (avant la section Bookings elle-même) car une candidature
-- "Retenu" doit automatiquement générer un booking.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),

  figurant_id uuid not null references public.figurants (id) on delete cascade,
  projet_id uuid not null references public.projets (id) on delete cascade,
  candidature_id uuid references public.candidatures (id) on delete set null unique,

  date date not null,
  heure_convocation time,
  fonction text,

  statut text not null default 'proposé' check (statut in ('proposé', 'confirmé', 'présent', 'annulé')),
  statut_reponse text not null default 'non_envoyé' check (statut_reponse in ('non_envoyé', 'envoyé', 'ok_dispo', 'indisponible')),

  -- Règle bloquante : un booking ne peut pas être confirmé sans réponse "Ok, dispo" enregistrée.
  constraint booking_confirme_requiert_ok_dispo
    check (statut <> 'confirmé' or statut_reponse = 'ok_dispo'),

  lien_myrole_envoye boolean not null default false,
  convocation_envoyee boolean not null default false,
  notes text,

  covoiturage_role text check (covoiturage_role in ('conducteur', 'passager')),
  covoiturage_lieu_depart text,
  covoiturage_places_disponibles smallint,
  covoiturage_conducteur_id uuid references public.figurants (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_figurant_id_idx on public.bookings (figurant_id);
create index if not exists bookings_projet_id_idx on public.bookings (projet_id);
create index if not exists bookings_date_idx on public.bookings (date);
create index if not exists bookings_statut_idx on public.bookings (statut);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "authenticated full access" on public.bookings
  for all to authenticated using (true) with check (true);

grant all on public.bookings to service_role, authenticated;
