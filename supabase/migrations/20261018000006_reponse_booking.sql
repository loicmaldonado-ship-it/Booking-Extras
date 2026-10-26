-- « Répondu booking » : la personne a accepté la proposition de booking
-- (cocher la case la passe en CONFIRMÉ). Distinct de « Répondu
-- convocation » (reponse_recue, le BIEN REÇU de la veille).
alter table public.bookings
  add column if not exists reponse_booking boolean not null default false,
  add column if not exists reponse_booking_le timestamptz;

-- Les profils déjà confirmés ont, de fait, répondu à la proposition.
update public.bookings set reponse_booking = true where statut = 'confirmé' and not reponse_booking;
