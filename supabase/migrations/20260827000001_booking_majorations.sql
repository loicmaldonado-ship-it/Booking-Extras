-- Permet d'appliquer une majoration du barème (Cinéma/Audiovisuelle — nuit,
-- dimanche, costume spécial...) à des bookings précis, au même titre que
-- les indemnités propres au projet, pour qu'elle ressorte sur le
-- bordereau d'émargement. L'app ne calcule pas le montant réel (variable
-- selon %, cachet doublé...) — seule la mention doit apparaître, Myrole
-- fait le calcul de paie.

create table if not exists public.booking_majorations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  bareme_majoration_id uuid not null references public.bareme_majorations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, bareme_majoration_id)
);

create index if not exists booking_majorations_booking_id_idx on public.booking_majorations (booking_id);

alter table public.booking_majorations enable row level security;

create policy "authenticated full access" on public.booking_majorations
  for all to authenticated using (true) with check (true);

grant all on public.booking_majorations to service_role, authenticated;
