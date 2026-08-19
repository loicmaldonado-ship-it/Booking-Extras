-- Besoins de casting par journée : "il nous faut 15 Passant, 2 Silhouette videur..."
-- pour pouvoir suivre le décompte réservé vs. besoin.

create table if not exists public.journee_besoins (
  id uuid primary key default gen_random_uuid(),
  journee_id uuid not null references public.journees(id) on delete cascade,
  fonction text not null,
  quantite integer not null check (quantite > 0),
  created_at timestamptz not null default now(),
  unique (journee_id, fonction)
);

create index if not exists journee_besoins_journee_id_idx on public.journee_besoins (journee_id);

alter table public.journee_besoins enable row level security;

drop policy if exists "scoped by projet" on public.journee_besoins;
create policy "scoped by projet" on public.journee_besoins for all to authenticated
  using (
    exists (
      select 1 from public.journees
      where journees.id = journee_besoins.journee_id
        and public.has_projet_access(journees.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.journees
      where journees.id = journee_besoins.journee_id
        and public.has_projet_access(journees.projet_id)
    )
  );

grant all on public.journee_besoins to service_role, authenticated;
