-- Boîte Gmail d'envoi par défaut, au niveau de la cheffe (et non plus
-- seulement par projet) : sans ça, chaque nouvelle cheffe (ex. Claire
-- Pouzaud) devait reconfigurer son adresse Gmail sur chacun de ses projets,
-- et tout partait de la boîte partagée par défaut entre-temps. Un projet
-- garde la possibilité de définir sa propre adresse pour l'écraser
-- ponctuellement (priorité : projet > cheffe propriétaire > boîte partagée).
alter table public.profiles add column if not exists gmail_smtp_user text;
alter table public.profiles add column if not exists gmail_smtp_app_password text;
