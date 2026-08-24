-- Nouvelle étape de validation dans la progression des bookings, entre le
-- suivi habituel et la confirmation finale : une fois la vidéo/les photos
-- de casting envoyées, le profil passe "Attente validation" pendant que le
-- réal décide, puis "Validé" avant la confirmation définitive.
alter table public.bookings drop constraint if exists bookings_statut_check;
alter table public.bookings
  add constraint bookings_statut_check
  check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'attente_validation', 'valide', 'confirmé', 'indisponible', 'annulé'));

-- Photos spécifiques à une présentation casting (en plus du portrait/pied
-- habituels) — même table que le reste des photos, juste un type de plus,
-- scopées par projet comme "tenue" (une même personne peut avoir une
-- présentation casting différente par projet).
alter table public.figurant_photos drop constraint if exists figurant_photos_type_check;
alter table public.figurant_photos add constraint figurant_photos_type_check
  check (type in ('portrait', 'pied', 'autre', 'selfie', 'tenue', 'vehicule', 'casting'));

-- Nouveau type de lien de partage, même mécanisme que documents/essayages.
alter table public.partage_liens drop constraint if exists partage_liens_type_check;
alter table public.partage_liens
  add constraint partage_liens_type_check
  check (type in ('documents', 'essayages', 'casting'));

-- Une "entrée casting" = une personne, pour un projet, à présenter au réal.
-- Rattachée à un booking quand il existe déjà, mais peut aussi exister
-- seule (une candidature qu'on veut présenter avant même de booker).
-- silhouette=true -> présentée en trombi seul (pas de vidéo) sur le lien de
-- partage réal ; silhouette=false -> présentation complète avec vidéo.
create table public.casting_entries (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  candidature_id uuid references public.candidatures (id) on delete set null,
  silhouette boolean not null default false,
  role_label text,
  request_token uuid not null default gen_random_uuid() unique,
  video_storage_path text,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (projet_id, figurant_id)
);

create index casting_entries_projet_id_idx on public.casting_entries (projet_id);

alter table public.casting_entries enable row level security;

create policy "authenticated full access" on public.casting_entries
  for all to authenticated using (true) with check (true);

grant all on public.casting_entries to service_role, authenticated;

insert into storage.buckets (id, name, public)
values ('casting-videos', 'casting-videos', false)
on conflict (id) do nothing;

create policy "authenticated read casting videos" on storage.objects
  for select to authenticated using (bucket_id = 'casting-videos');

create policy "authenticated upload casting videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'casting-videos');

create policy "authenticated delete casting videos" on storage.objects
  for delete to authenticated using (bucket_id = 'casting-videos');
