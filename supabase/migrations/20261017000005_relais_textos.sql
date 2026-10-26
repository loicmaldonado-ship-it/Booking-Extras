-- Textos en masse depuis le Mac de la cheffe : le site met les textos en
-- file, un petit relais sur son Mac (clé personnelle) les récupère et les
-- envoie avec l'app Messages, depuis son propre numéro.
create table if not exists public.relais_textos (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  cle_hash text not null unique,
  derniere_activite timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.textos_file (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  telephone text not null,
  destinataire text,
  message text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'envoi', 'envoye', 'erreur', 'annule')),
  erreur text,
  created_at timestamptz not null default now(),
  pris_le timestamptz,
  envoye_le timestamptz
);
create index if not exists textos_file_profile_statut_idx on public.textos_file (profile_id, statut, created_at);

alter table public.relais_textos enable row level security;
alter table public.textos_file enable row level security;
grant all on public.relais_textos to service_role;
grant all on public.textos_file to service_role;
