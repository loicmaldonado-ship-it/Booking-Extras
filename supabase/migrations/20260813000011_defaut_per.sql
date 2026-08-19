-- Dès qu'un figurant est placé sur une journée (candidature retenue, ou
-- glisser-déposer dans le planning), il doit apparaître en PER (Pas Encore
-- de Réponse) — pas "Non envoyé". Le contact est implicite dès qu'on le met
-- sur la journée.
alter table public.bookings alter column statut_reponse set default 'envoyé';
