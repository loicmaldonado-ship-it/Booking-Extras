-- Photos "en tenue" prises pendant un essayage — rattachées à un projet
-- précis, elles remplacent le portrait générique sur les trombis et fiches
-- mensu de CE projet uniquement (le portrait générique reste utilisé
-- partout ailleurs, y compris sur les autres projets).
alter table public.figurant_photos
  add column if not exists projet_id uuid references public.projets (id) on delete cascade;

create index if not exists figurant_photos_projet_id_idx on public.figurant_photos (projet_id);

alter table public.figurant_photos drop constraint if exists figurant_photos_type_check;
alter table public.figurant_photos add constraint figurant_photos_type_check
  check (type in ('portrait', 'pied', 'autre', 'selfie', 'tenue'));
