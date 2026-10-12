-- Modification du plan de travail (PDT) : une journée est basculée vers une
-- nouvelle date (« journée miroir »). Chaque profil y apparaît en statut
-- « À REBOOKER », relié à son booking d'origine ; dès que l'équipe change ce
-- statut (rebooké, indispo…), le booking d'origine disparaît de l'ancienne
-- journée, qu'on peut supprimer une fois vide. Les autres journées et les
-- profils déjà calés à la nouvelle date ne sont pas touchés.

alter table public.bookings drop constraint if exists bookings_statut_check;
alter table public.bookings
  add constraint bookings_statut_check
  check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'attente_validation', 'valide', 'confirmé', 'indisponible', 'annulé', 'a_rebooker'));

alter table public.bookings
  add column if not exists rebook_depuis_booking_id uuid references public.bookings (id) on delete set null;
create index if not exists bookings_rebook_depuis_idx on public.bookings (rebook_depuis_booking_id);

-- Journée d'origine : date vers laquelle elle a été basculée (bandeau +
-- suppression une fois tout le monde rebooké).
alter table public.journees add column if not exists pdt_vers date;

-- Message envoyé aux profils lors d'une modification du PDT, calibré par
-- l'équipe et mémorisé par projet.
alter table public.projets add column if not exists modele_message_pdt text;

create or replace function public.finaliser_rebooking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidature uuid;
begin
  if old.statut = 'a_rebooker' and new.statut <> 'a_rebooker' and new.rebook_depuis_booking_id is not null then
    select candidature_id into v_candidature from public.bookings where id = new.rebook_depuis_booking_id;
    delete from public.bookings where id = new.rebook_depuis_booking_id;
    -- Le lien vers la candidature (unique) suit la personne sur la nouvelle date.
    update public.bookings
       set rebook_depuis_booking_id = null,
           candidature_id = coalesce(candidature_id, v_candidature)
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_finaliser_rebooking on public.bookings;
create trigger bookings_finaliser_rebooking
  after update of statut on public.bookings
  for each row
  execute function public.finaliser_rebooking();
