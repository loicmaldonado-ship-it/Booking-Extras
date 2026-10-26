-- Trois statuts de booking en plus (demande de Loïc) : Attente réponse
-- booking (orange foncé), À rappeler (bleu foncé), À annuler (rouge pâle).
alter table public.bookings drop constraint bookings_statut_check;
alter table public.bookings add constraint bookings_statut_check check (statut = any (array[
  'proposé', 'envoyé', 'attente_reponse_booking', 'a_relancer', 'doit_rappeler', 'a_rappeler',
  'attente_validation', 'valide', 'confirmé', 'indisponible', 'a_annuler', 'annulé', 'a_rebooker'
]));
