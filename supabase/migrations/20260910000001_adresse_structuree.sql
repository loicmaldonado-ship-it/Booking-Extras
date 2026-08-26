-- Code postal séparé de l'adresse (rue) pour pouvoir exiger une adresse de
-- résidence réellement complète à la candidature et à la création de
-- profil — jusqu'ici "adresse" était un simple champ libre facultatif côté
-- candidature, ce qui a laissé passer des profils incomplets.
alter table public.figurants add column if not exists code_postal text;
