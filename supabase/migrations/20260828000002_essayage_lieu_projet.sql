-- Le lieu d'essayage se calibre une fois pour tout le projet (pas journée
-- par journée) — table dédiée au module essayages, pas de colonne sur
-- projets. Réutilisé automatiquement sur toutes les journées d'essayage.

create table if not exists public.essayage_lieux (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null unique references public.projets (id) on delete cascade,
  nom text,
  adresse text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.essayage_lieux enable row level security;

create policy "authenticated full access" on public.essayage_lieux
  for all to authenticated using (true) with check (true);

grant all on public.essayage_lieux to service_role, authenticated;
