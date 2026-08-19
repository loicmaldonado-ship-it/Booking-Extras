-- Suivi de réponse pour les essayages, en miroir du champ reponse_recue des bookings.

alter table public.essayages add column if not exists reponse_recue boolean not null default false;
