-- Le mail d'activation de l'espace personnel doit repartir une fois par
-- projet (pas une seule fois pour toute la vie du profil, sinon un
-- figurant déjà actif ne serait jamais prévenu d'un nouveau tournage) —
-- traçage via figurant_messages, nouvelle catégorie "espace_perso".

alter table public.figurant_messages
  add column if not exists projet_id uuid references public.projets (id) on delete cascade;

create index if not exists figurant_messages_projet_id_idx on public.figurant_messages (projet_id);

alter table public.figurant_messages
  drop constraint if exists figurant_messages_categorie_check;

alter table public.figurant_messages
  add constraint figurant_messages_categorie_check
  check (categorie in ('booking', 'convocation', 'covoiturage', 'essayage', 'libre', 'espace_perso'));
