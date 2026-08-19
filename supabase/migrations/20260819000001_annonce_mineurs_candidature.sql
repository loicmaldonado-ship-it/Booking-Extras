-- Annonces peuvent explicitement s'ouvrir aux moins de 16 ans (fermé par
-- défaut) ; les candidatures gagnent une date de naissance obligatoire pour
-- pouvoir bloquer les mineurs sur les annonces qui ne les acceptent pas.

alter table public.annonces add column if not exists ouverte_mineurs boolean not null default false;
alter table public.candidatures add column if not exists date_naissance date;
