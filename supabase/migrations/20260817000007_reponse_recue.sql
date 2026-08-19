-- Suivi manuel de la réponse à la convocation, indépendant de l'envoi
-- (convocation_envoyee = on l'a envoyée ; reponse_recue = la personne a
-- répondu/confirmé, en général par téléphone ou SMS, à cocher à la main).
alter table public.bookings add column if not exists reponse_recue boolean not null default false;
