-- Requis par le gabarit d'import Myrole ("Commune de naissance *") mais pas
-- encore collecté sur la fiche Figurant.
alter table public.figurants
  add column if not exists commune_naissance text;
