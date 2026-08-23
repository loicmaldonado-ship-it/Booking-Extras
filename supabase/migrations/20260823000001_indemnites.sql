-- Indemnités : tarifs nommés définis par projet (ex. Prime nuit, Repas...),
-- applicables à des bookings précis pour qu'ils ressortent sur le bordereau
-- d'émargement, au même titre que les majorations du barème.

create table if not exists public.projet_indemnites (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  label text not null,
  montant numeric(8,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists projet_indemnites_projet_id_idx on public.projet_indemnites (projet_id);

create table if not exists public.booking_indemnites (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  projet_indemnite_id uuid not null references public.projet_indemnites (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, projet_indemnite_id)
);

create index if not exists booking_indemnites_booking_id_idx on public.booking_indemnites (booking_id);

alter table public.projet_indemnites enable row level security;
alter table public.booking_indemnites enable row level security;

create policy "authenticated full access" on public.projet_indemnites
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.booking_indemnites
  for all to authenticated using (true) with check (true);

grant all on public.projet_indemnites to service_role, authenticated;
grant all on public.booking_indemnites to service_role, authenticated;
