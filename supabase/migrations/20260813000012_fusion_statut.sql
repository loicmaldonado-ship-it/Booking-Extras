-- Fusion des deux champs (statut du booking + réponse du figurant) en un
-- seul statut, pour une progression unique et lisible d'un coup d'œil :
-- Proposé -> PER -> À relancer / Doit rappeler -> CONFIRMÉ -> Présent
-- (Indisponible / Annulé possibles à tout moment).

-- 1. Anciennes contraintes liées aux deux champs séparés — à retirer avant
--    de migrer les données, sinon les valeurs intermédiaires les violent.
alter table public.bookings drop constraint if exists bookings_statut_check;
alter table public.bookings drop constraint if exists bookings_statut_reponse_check;
alter table public.bookings drop constraint if exists booking_confirme_requiert_ok_dispo;

-- 2. Migrer les données existantes vers les nouvelles valeurs.
update public.bookings
set statut = case
  when statut = 'présent' then 'présent'
  when statut = 'annulé' then 'annulé'
  when statut = 'confirmé' then 'confirmé'
  when statut_reponse = 'ok_dispo' then 'confirmé'
  when statut_reponse = 'indisponible' then 'indisponible'
  when statut_reponse = 'a_relancer' then 'a_relancer'
  when statut_reponse = 'doit_rappeler' then 'doit_rappeler'
  when statut_reponse = 'envoyé' then 'envoyé'
  else 'proposé'
end;

-- 3. Nouvelle contrainte : un seul statut, une seule progression.
alter table public.bookings
  add constraint bookings_statut_check
  check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'confirmé', 'présent', 'indisponible', 'annulé'));

alter table public.bookings alter column statut set default 'envoyé';

-- 4. La colonne statut_reponse n'existe plus en tant que concept séparé.
alter table public.bookings drop column if exists statut_reponse;

-- 5. Règle bloquante (remplace l'ancienne) : impossible de passer à
--    "présent" sans être déjà passé par "confirmé" — un trigger est
--    nécessaire ici (pas un simple check) car la règle dépend de l'état
--    précédent de la ligne, pas seulement de sa nouvelle valeur.
create or replace function public.check_present_requiert_confirme()
returns trigger as $$
begin
  if new.statut = 'présent' and old.statut not in ('confirmé', 'présent') then
    raise exception 'booking_present_requiert_confirme';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists bookings_present_requiert_confirme on public.bookings;
create trigger bookings_present_requiert_confirme
  before update on public.bookings
  for each row execute function public.check_present_requiert_confirme();
