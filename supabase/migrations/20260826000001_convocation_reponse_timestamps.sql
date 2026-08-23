-- Horodatage de l'envoi de convocation et de la réponse reçue, pour pouvoir
-- afficher un délai (en minutes/heures — les convocations partent en
-- général la veille du tournage, la journée n'est pas la bonne unité).

alter table public.bookings
  add column if not exists convocation_envoyee_le timestamptz,
  add column if not exists reponse_recue_le timestamptz;
