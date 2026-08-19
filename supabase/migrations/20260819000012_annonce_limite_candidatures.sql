-- Limite optionnelle du nombre de candidatures acceptées par annonce,
-- modifiable à tout moment (y compris après la création de l'annonce).

alter table public.annonces add column if not exists limite_candidatures integer;
