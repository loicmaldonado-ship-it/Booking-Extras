-- Photos propres à chaque candidature : celles envoyées avec la
-- candidature, ou choisies parmi les photos déjà sur le compte. Les photos
-- restent dans la photothèque du compte (figurant_photos) pour être
-- réutilisées ; cette table dit lesquelles accompagnent quelle candidature.
-- Les anciennes candidatures n'ont pas de lignes ici : on affiche alors les
-- photos du compte, comme avant.
create table if not exists public.candidature_photos (
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  photo_id uuid not null references public.figurant_photos (id) on delete cascade,
  emplacement text not null check (emplacement in ('portrait', 'pied', 'selfie', 'vehicule', 'autre')),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (candidature_id, photo_id)
);

create index if not exists candidature_photos_photo_id_idx on public.candidature_photos (photo_id);

alter table public.candidature_photos enable row level security;
grant all on public.candidature_photos to service_role;
