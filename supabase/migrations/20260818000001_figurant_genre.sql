-- Genre (Femme/Homme/Non-binaire) : distinct de la civilité (Mme/M./Autre,
-- nécessaire telle quelle pour l'export Myrole). Utilisé pour les décomptes
-- démographiques (bookings, journées).

alter table public.figurants add column if not exists genre text
  check (genre in ('Femme', 'Homme', 'Non-binaire'));
