-- Deux nouvelles categories de transport en plus de conducteur/passager :
-- "ppm" (par ses propres moyens, indemnite transport individuelle) et
-- "transport_commun" (aucune indemnite, juste une categorisation).
alter table public.bookings drop constraint if exists bookings_covoiturage_role_check;
alter table public.bookings add constraint bookings_covoiturage_role_check
  check (covoiturage_role in ('conducteur', 'passager', 'ppm', 'transport_commun'));
