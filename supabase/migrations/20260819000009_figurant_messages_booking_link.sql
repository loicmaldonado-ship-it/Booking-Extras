-- Permet de lier un message interne à un booking précis (convocation),
-- pour que le "BIEN REÇU" du candidat marque automatiquement le booking
-- comme répondu (surbrillance jaune fluo + décompte dans Booking).

alter table public.figurant_messages add column if not exists booking_id uuid references public.bookings (id) on delete set null;

create index if not exists figurant_messages_booking_id_idx on public.figurant_messages (booking_id);
