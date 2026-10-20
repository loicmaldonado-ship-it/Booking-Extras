-- Lien réal du casting : ce que le·la réal voit et peut faire se règle côté
-- équipe, par lien. Par défaut, les liens existants gardent leur affichage
-- actuel (âge, taille, mensurations, réponses) ; ville, avis et commentaires
-- par profil sont désactivés.
alter table public.partage_liens
  add column if not exists reel_afficher_age boolean not null default true,
  add column if not exists reel_afficher_ville boolean not null default false,
  add column if not exists reel_afficher_taille boolean not null default true,
  add column if not exists reel_afficher_mensurations boolean not null default true,
  add column if not exists reel_afficher_reponses boolean not null default true,
  add column if not exists reel_avis boolean not null default false,
  add column if not exists reel_commentaires_profil boolean not null default false;

-- Commentaires par profil (même fil que le lien, avec le profil visé).
alter table public.partage_commentaires
  add column if not exists casting_entry_id uuid references public.casting_entries (id) on delete cascade;
create index if not exists partage_commentaires_casting_entry_idx
  on public.partage_commentaires (casting_entry_id) where casting_entry_id is not null;

-- Avis Oui / Peut-être / Non de chaque visiteur·se sur un profil du casting.
create table if not exists public.casting_avis (
  id uuid primary key default gen_random_uuid(),
  lien_id uuid not null references public.partage_liens (id) on delete cascade,
  entry_id uuid not null references public.casting_entries (id) on delete cascade,
  visiteur_id text not null,
  visiteur_nom text not null,
  visiteur_role text not null default '',
  avis text not null check (avis in ('oui', 'peut_etre', 'non')),
  updated_at timestamptz not null default now(),
  unique (entry_id, visiteur_id)
);
create index if not exists casting_avis_lien_idx on public.casting_avis (lien_id);

alter table public.casting_avis enable row level security;
grant all on public.casting_avis to service_role;
