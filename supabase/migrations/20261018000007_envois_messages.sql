-- Onglet Messages de la journée : chaque message d'info envoyé à une
-- sélection devient un « envoi » nommé, avec le suivi de chaque
-- destinataire (envoyé, accusé de réception en un clic, échec, relances).
create table if not exists public.envois (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  date date,
  titre text not null,
  sujet text not null default '',
  corps text not null,
  canal text not null default 'email' check (canal in ('email', 'texto')),
  avec_accuse boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists envois_projet_date_idx on public.envois (projet_id, date);

create table if not exists public.envoi_destinataires (
  id uuid primary key default gen_random_uuid(),
  envoi_id uuid not null references public.envois(id) on delete cascade,
  figurant_id uuid not null references public.figurants(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  -- Lien « 👍 Bien reçu » (page publique /recu/<token>).
  token uuid not null unique default gen_random_uuid(),
  envoye_le timestamptz,
  erreur text,
  accuse_le timestamptz,
  relances integer not null default 0,
  derniere_relance_le timestamptz,
  unique (envoi_id, figurant_id)
);

create index if not exists envoi_destinataires_envoi_idx on public.envoi_destinataires (envoi_id);

-- Accès uniquement par le serveur (client admin).
alter table public.envois enable row level security;
alter table public.envoi_destinataires enable row level security;
grant all on public.envois to service_role;
grant all on public.envoi_destinataires to service_role;
