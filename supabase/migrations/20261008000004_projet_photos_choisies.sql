-- Photos choisies dans Booking pour les trombis et fiches mensuration d'une
-- personne sur un projet (jusqu'à 3, la première = photo principale). Sans
-- ligne ici : photos de l'essayage du projet, sinon de la candidature,
-- sinon du compte (voir src/lib/documents/photos-projet.ts).
create table if not exists public.projet_photos_choisies (
  projet_id uuid not null references public.projets (id) on delete cascade,
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  photo_ids uuid[] not null,
  updated_at timestamptz not null default now(),
  primary key (projet_id, figurant_id)
);

alter table public.projet_photos_choisies enable row level security;
grant all on public.projet_photos_choisies to service_role;
