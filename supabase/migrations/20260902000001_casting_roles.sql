-- Casting repensé comme les essayages : des "rôles" (ex. Boulanger, tournage
-- le 12/09) qu'on crée d'abord, dans lesquels on range ensuite des profils
-- venus de la base, d'un booking ou d'une candidature — plutôt qu'un
-- toggle silhouette/rôle par entrée. Chaque rôle calibre lui-même ce qu'on
-- demande au candidat (nb de vidéos, libellés des photos, bande démo).
create table public.casting_roles (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  nom text not null,
  date_tournage date,
  nb_videos integer not null default 1 check (nb_videos >= 0),
  -- Un élément par photo demandée, son libellé ("Portrait", "Pied"...) —
  -- la longueur du tableau EST le nombre de photos demandées, pas de
  -- colonne séparée à garder synchronisée.
  photo_labels text[] not null default '{Portrait,Pied,Autre}',
  demande_bande_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (projet_id, nom)
);

create index casting_roles_projet_id_idx on public.casting_roles (projet_id);

alter table public.casting_roles enable row level security;
create policy "scoped by projet" on public.casting_roles for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
grant all on public.casting_roles to service_role, authenticated;

-- casting_entries n'avait encore aucune donnée réelle (fonctionnalité livrée
-- puis reprise dans la même itération) : restructuration directe, sans
-- migration de données.
alter table public.casting_entries drop constraint if exists casting_entries_projet_id_figurant_id_key;
alter table public.casting_entries add column role_id uuid not null references public.casting_roles (id) on delete cascade;
alter table public.casting_entries add constraint casting_entries_role_id_figurant_id_key unique (role_id, figurant_id);

alter table public.casting_entries drop column if exists silhouette;
alter table public.casting_entries drop column if exists role_label;
alter table public.casting_entries drop column if exists video_storage_path;
alter table public.casting_entries add column video_storage_paths text[] not null default '{}';

create index casting_entries_role_id_idx on public.casting_entries (role_id);

drop policy if exists "authenticated full access" on public.casting_entries;
create policy "scoped by projet" on public.casting_entries for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

-- Rattache une photo envoyée pour un casting à l'entrée + au libellé demandé
-- ("Pied", "Portrait"...), tout en restant dans le trombi général de la
-- personne (même table que les autres photos).
alter table public.figurant_photos add column if not exists casting_entry_id uuid references public.casting_entries (id) on delete set null;
alter table public.figurant_photos add column if not exists label text;

alter table public.figurant_messages drop constraint if exists figurant_messages_categorie_check;
alter table public.figurant_messages add constraint figurant_messages_categorie_check
  check (categorie in ('booking', 'convocation', 'covoiturage', 'essayage', 'casting', 'libre', 'espace_perso'));
