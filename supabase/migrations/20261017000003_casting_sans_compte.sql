-- Postuler à un casting sans compte : la personne arrive dans la base
-- privée de la cheffe (fiches comédien·nes / casting, pool de la cheffe),
-- jamais dans la Base Profils partagée. Repère pour l'afficher.
alter table public.figurants add column if not exists cree_via_casting boolean not null default false;
