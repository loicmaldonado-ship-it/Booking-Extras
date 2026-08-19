create table if not exists public.journees (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (projet_id, date)
);

insert into public.journees (projet_id, date)
select distinct projet_id, date from public.bookings
on conflict (projet_id, date) do nothing;
