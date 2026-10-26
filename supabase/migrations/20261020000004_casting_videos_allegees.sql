-- Allègement des vidéos du casting après l'envoi (ffmpeg côté serveur) :
-- une ligne par vidéo traitée, pour ne jamais la retraiter ni la perdre.
-- Les vidéos déjà en ligne sont marquées « ignore » : elles ne sont pas
-- touchées (seules les nouvelles sont allégées).
create table if not exists public.casting_videos_allegees (
  path text primary key,
  statut text not null check (statut in ('en_cours', 'ok', 'ignore', 'erreur')),
  octets_avant bigint,
  octets_apres bigint,
  duree_s integer,
  message text,
  essais integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.casting_videos_allegees enable row level security;
grant all on public.casting_videos_allegees to service_role;

insert into public.casting_videos_allegees (path, statut, message)
select distinct unnest(video_storage_paths), 'ignore', 'Déjà en ligne avant l''allègement automatique'
from public.casting_entries
on conflict (path) do nothing;
