-- Ajoute "Autre" aux valeurs possibles de genre (en plus de
-- Femme/Homme/Non-binaire), demandé par la cheffe pour les candidatures
-- et fiches profil où aucune des 3 options ne correspond.

alter table public.figurants drop constraint if exists figurants_genre_check;
alter table public.figurants add constraint figurants_genre_check
  check (genre in ('Femme', 'Homme', 'Non-binaire', 'Autre'));
