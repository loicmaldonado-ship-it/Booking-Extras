create or replace function public.enforce_minor_booking()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare birth date;
begin
 if new.statut='annulé' then return new; end if;
 select date_naissance into birth from public.figurants where id=new.figurant_id;
 if birth is null or birth>new.date then raise exception 'Date de naissance valide obligatoire avant booking : complète la fiche profil' using errcode='23514'; end if;
 if birth>new.date-interval '18 years' and not public.minor_dossier_complete(new.projet_id,new.figurant_id,new.date) then
  raise exception 'Dossier mineur incomplet : représentants, autorisations validées et pièces requises avant booking' using errcode='23514';
 end if;
 return new;
end;
$fn$;
revoke all on function public.enforce_minor_booking() from public,anon,authenticated;

create or replace function public.enforce_minor_convocation()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare booking public.bookings; birth date;
begin
 if new.sender<>'staff' or new.categorie is distinct from 'convocation' or new.booking_id is null then return new; end if;
 select * into booking from public.bookings where id=new.booking_id;
 if not found or booking.figurant_id<>new.figurant_id or new.projet_id is distinct from booking.projet_id then raise exception 'Booking incompatible avec le message' using errcode='23514'; end if;
 select date_naissance into birth from public.figurants where id=booking.figurant_id;
 if birth is null or birth>booking.date then raise exception 'Date de naissance valide obligatoire avant convocation : complète la fiche profil' using errcode='23514'; end if;
 if birth>booking.date-interval '18 years' and not public.minor_dossier_complete(booking.projet_id,booking.figurant_id,booking.date) then
  raise exception 'Dossier mineur incomplet : convocation refusée' using errcode='23514';
 end if;
 return new;
end;
$fn$;
revoke all on function public.enforce_minor_convocation() from public,anon,authenticated;

notify pgrst,'reload schema';
