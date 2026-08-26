-- Sections accessibles pour un·e assistant·e (Bookings, Casting,
-- Candidatures...) — NULL = accès complet (comportement historique, aucune
-- restriction tant que la cheffe n'a rien coché explicitement), tableau
-- non-null = liste blanche des sections autorisées. Sans effet pour les
-- comptes "chef" (toujours accès complet).
alter table public.profiles add column if not exists sections_autorisees text[];
