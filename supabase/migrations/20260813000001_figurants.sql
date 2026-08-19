-- Figurants: profil permanent, réutilisable pour tous les projets

create table if not exists public.figurants (
  id uuid primary key default gen_random_uuid(),

  civilite text check (civilite in ('Mme', 'M.', 'Autre')),
  prenom text not null,
  nom text not null,
  pronom text check (pronom in ('Elle', 'Il', 'Iel')),

  email text,
  telephone text,
  ville text,
  date_naissance date,

  taille_cm smallint,
  poids_kg smallint,
  pointure numeric(4,1),
  tour_poitrine_cm smallint,
  tour_taille_cm smallint,
  tour_hanches_cm smallint,
  tour_tete_cm smallint,
  couleur_yeux text,
  couleur_cheveux text,

  compte_myrole boolean not null default false,
  tags text[] not null default '{}',
  notes_internes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists figurants_nom_prenom_idx on public.figurants (nom, prenom);
create index if not exists figurants_ville_idx on public.figurants (ville);
create index if not exists figurants_tags_idx on public.figurants using gin (tags);

-- Photos: portrait + pied obligatoires, 2 autres, selfie récent daté
create table if not exists public.figurant_photos (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  type text not null check (type in ('portrait', 'pied', 'autre', 'selfie')),
  storage_path text not null,
  prise_le date,
  created_at timestamptz not null default now()
);

create index if not exists figurant_photos_figurant_id_idx on public.figurant_photos (figurant_id);

-- Liens multiples: bande démo, Instagram, etc.
create table if not exists public.figurant_liens (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists figurant_liens_figurant_id_idx on public.figurant_liens (figurant_id);

-- updated_at auto
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists figurants_set_updated_at on public.figurants;
create trigger figurants_set_updated_at
  before update on public.figurants
  for each row execute function public.set_updated_at();

-- RLS: accès complet pour tout utilisateur authentifié pour l'instant.
-- La granularité par rôle (Assistant / Collaborateur) sera affinée
-- quand on construira la section Auth & Rôles.
alter table public.figurants enable row level security;
alter table public.figurant_photos enable row level security;
alter table public.figurant_liens enable row level security;

create policy "authenticated full access" on public.figurants
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.figurant_photos
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.figurant_liens
  for all to authenticated using (true) with check (true);

-- Depuis la CLI récente, les nouvelles tables ne sont plus exposées
-- automatiquement aux rôles de la Data API : il faut les GRANT explicitement.
grant usage on schema public to anon, authenticated, service_role;

grant all on public.figurants to service_role, authenticated;
grant all on public.figurant_photos to service_role, authenticated;
grant all on public.figurant_liens to service_role, authenticated;

-- Stockage des photos de figurants
insert into storage.buckets (id, name, public)
values ('figurant-photos', 'figurant-photos', false)
on conflict (id) do nothing;

create policy "authenticated read figurant photos" on storage.objects
  for select to authenticated using (bucket_id = 'figurant-photos');

create policy "authenticated upload figurant photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'figurant-photos');

create policy "authenticated update figurant photos" on storage.objects
  for update to authenticated using (bucket_id = 'figurant-photos');

create policy "authenticated delete figurant photos" on storage.objects
  for delete to authenticated using (bucket_id = 'figurant-photos');
