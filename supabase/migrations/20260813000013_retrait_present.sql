-- Retrait du statut "présent" : la progression s'arrête à CONFIRMÉ.
-- Proposé -> PER -> À relancer / Doit rappeler -> CONFIRMÉ
-- (Indisponible / Annulé possibles à tout moment).

-- 1. Le trigger qui bloquait "présent" sans passer par "confirmé" n'a plus
--    lieu d'être : ce statut disparaît.
drop trigger if exists bookings_present_requiert_confirme on public.bookings;
drop function if exists public.check_present_requiert_confirme();

-- 2. Anciennes lignes "présent" -> "confirmé" (elles avaient nécessairement
--    déjà été confirmées pour atteindre cet état).
alter table public.bookings drop constraint if exists bookings_statut_check;

update public.bookings set statut = 'confirmé' where statut = 'présent';

alter table public.bookings
  add constraint bookings_statut_check
  check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'confirmé', 'indisponible', 'annulé'));
