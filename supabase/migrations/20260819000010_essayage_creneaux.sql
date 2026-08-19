-- Créneaux horaires pour les journées d'essayage : plage horaire + capacité,
-- pour organiser le planning et répartir les figurants par tranche.

create table if not exists public.essayage_creneaux (
  id uuid primary key default gen_random_uuid(),
  essayage_journee_id uuid not null references public.essayage_journees (id) on delete cascade,
  heure_debut time not null,
  heure_fin time not null,
  capacite integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists essayage_creneaux_journee_id_idx on public.essayage_creneaux (essayage_journee_id);

alter table public.essayages add column if not exists creneau_id uuid references public.essayage_creneaux (id) on delete set null;

alter table public.essayage_creneaux enable row level security;

create policy "authenticated full access" on public.essayage_creneaux
  for all to authenticated using (true) with check (true);

grant all on public.essayage_creneaux to service_role, authenticated;
