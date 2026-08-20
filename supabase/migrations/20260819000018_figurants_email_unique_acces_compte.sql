-- 1 email = 1 fiche : empêche toute création de doublon par email, quel que
-- soit le chemin (postulerAnnonce, création manuelle, seed scripts).
create unique index if not exists figurants_email_unique_idx
  on public.figurants (lower(email))
  where email is not null;

-- Accès à /compte : ne s'active plus automatiquement dès la candidature.
-- Se débloque quand une candidature passe à "retenu" (ou manuellement par
-- le staff depuis la fiche figurant).
alter table public.figurants add column if not exists acces_compte boolean not null default false;
