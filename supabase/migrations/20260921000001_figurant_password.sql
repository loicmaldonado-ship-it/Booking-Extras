-- Mot de passe optionnel pour l'espace candidat·e (/compte), en plus du
-- lien magique déjà en place — jamais un remplacement, juste un accès plus
-- rapide une fois défini. Nullable : un profil sans mot de passe reste
-- valide, limité au lien magique par email comme aujourd'hui.
alter table public.figurants add column if not exists password_hash text;
