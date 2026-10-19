-- « Accès complet » (Loïc, Mathieu, Eléa) : parcourir librement la Base
-- Profils et révoquer l'accès d'un compte candidat·e. Les autres comptes
-- ne trouvent un profil qu'en le cherchant. Les comptes propriétaires
-- l'ont d'office (is_owner).
alter table public.profiles add column acces_complet boolean not null default false;
