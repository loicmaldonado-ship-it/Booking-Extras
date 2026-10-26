-- Annonce sur une période (ex. du 20/10 au 20/11) : une date par jour, et
-- les candidat·es cochent seulement leurs jours d'indisponibilité sur un
-- calendrier, au lieu de répondre oui/non à chaque date.
alter table public.annonces
  add column if not exists dispos_par_calendrier boolean not null default false;
