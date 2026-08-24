-- Véhicule du figurant — donnée de personne (comme les mensurations), donc
-- portée par figurants et pas par candidatures. Trois cases indépendantes
-- (vélo/moto/scooter) plutôt qu'un tableau : une personne peut cocher
-- plusieurs cases, et ça reste filtrable simplement avec .eq().
alter table public.figurants add column if not exists a_vehicule boolean;
alter table public.figurants add column if not exists vehicule_velo boolean not null default false;
alter table public.figurants add column if not exists vehicule_moto boolean not null default false;
alter table public.figurants add column if not exists vehicule_scooter boolean not null default false;
alter table public.figurants add column if not exists vehicule_marque text;

alter table public.figurant_photos drop constraint if exists figurant_photos_type_check;
alter table public.figurant_photos add constraint figurant_photos_type_check
  check (type in ('portrait', 'pied', 'autre', 'selfie', 'tenue', 'vehicule'));
