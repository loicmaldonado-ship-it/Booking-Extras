-- Base commune des agents (comédien·nes) — alimentée automatiquement quand
-- un agent est saisi sur une fiche ou une carte casting (voir upsertAgent),
-- pour pouvoir le retrouver et le sélectionner plus vite la fois suivante
-- au lieu de tout retaper. Gestion (liste complète, édition, suppression)
-- réservée au compte propriétaire ; la recherche rapide utilisée par
-- l'autocomplete reste accessible à toute l'équipe (mêmes infos déjà
-- visibles sur les fiches).
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  agence text,
  email text,
  telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_nom_idx on public.agents (lower(nom));

alter table public.agents enable row level security;

create policy "authenticated full access" on public.agents
  for all to authenticated using (true) with check (true);

grant all on public.agents to service_role, authenticated;
