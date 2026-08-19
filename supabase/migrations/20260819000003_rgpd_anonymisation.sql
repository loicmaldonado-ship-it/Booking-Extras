-- Mécanisme de rétention RGPD : suivi d'anonymisation par profil. Aucune
-- suppression/anonymisation automatique n'est déclenchée par cette
-- migration — c'est une action manuelle (voir lib/rgpd), en attendant de
-- fixer un délai d'inactivité avec la cheffe de casting.

alter table public.figurants add column if not exists anonymise boolean not null default false;
alter table public.figurants add column if not exists anonymise_le timestamptz;
