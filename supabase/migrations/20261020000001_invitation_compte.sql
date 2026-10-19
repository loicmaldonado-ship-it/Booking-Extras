-- Lien « Crée ton compte » envoyé aux profils ajoutés sans compte (ajout
-- rapide dans Bookings, ou fiche retrouvée en postulant) : même table que
-- les liens de connexion, mais il n'ouvre que la page de création du mot
-- de passe (/compte/creer), jamais une connexion directe.

alter table public.figurant_auth_tokens
  add column if not exists objet text not null default 'connexion';

alter table public.figurant_auth_tokens drop constraint if exists figurant_auth_tokens_objet_check;
alter table public.figurant_auth_tokens add constraint figurant_auth_tokens_objet_check
  check (objet in ('connexion', 'creation_compte'));
