-- Archivage de projet + profils figurants temporaires (rôles "soi-même" —
-- éboueur, chauffeur... — qui ne font de la figuration qu'une fois). Coché
-- à la candidature, le profil est supprimé quand le projet est archivé.

alter table public.projets
  add column if not exists archive boolean not null default false,
  add column if not exists archive_le timestamptz;

alter table public.figurants
  add column if not exists temporaire boolean not null default false,
  add column if not exists temporaire_projet_id uuid references public.projets (id) on delete set null;

create index if not exists figurants_temporaire_projet_id_idx
  on public.figurants (temporaire_projet_id)
  where temporaire = true;
