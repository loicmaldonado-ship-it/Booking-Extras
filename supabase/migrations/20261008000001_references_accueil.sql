-- Références affichées sur l'accueil public (films et séries sur lesquels
-- l'équipe a travaillé), gérées dans Admin → Références. Indépendantes des
-- projets : on peut y mettre des tournages antérieurs au site, et rien de
-- confidentiel n'apparaît par erreur.
create table if not exists public.references_accueil (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  type text not null default 'film' check (type in ('film', 'serie', 'court', 'pub', 'clip', 'autre')),
  annee integer check (annee between 1950 and 2100),
  realisation text,
  affiche_storage_path text,
  ordre integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lecture et écriture uniquement côté serveur (client admin) : aucune
-- politique publique.
alter table public.references_accueil enable row level security;
grant all on public.references_accueil to service_role;

-- Affiches : publiques (affichées sur l'accueil), envoyées par le serveur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('references-affiches', 'references-affiches', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public read references affiches" on storage.objects
  for select using (bucket_id = 'references-affiches');
