-- Système de suivi de relance plus fin sur le statut réponse d'un booking,
-- pour que toute l'équipe voie d'un coup d'œil où on en est :
-- non_envoyé -> envoyé (PER, pas encore de réponse) -> a_relancer / doit_rappeler
-- -> ok_dispo (vert) ou indisponible (rouge)

alter table public.bookings drop constraint if exists bookings_statut_reponse_check;
alter table public.bookings
  add constraint bookings_statut_reponse_check
  check (statut_reponse in ('non_envoyé', 'envoyé', 'a_relancer', 'doit_rappeler', 'ok_dispo', 'indisponible'));
