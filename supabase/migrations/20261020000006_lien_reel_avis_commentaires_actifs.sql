-- Avis Oui / Peut-être / Non et commentaires par profil : activés par défaut
-- sur le lien réal (ils restent décochables côté équipe), et activés sur les
-- liens existants.
alter table public.partage_liens alter column reel_avis set default true;
alter table public.partage_liens alter column reel_commentaires_profil set default true;
update public.partage_liens set reel_avis = true, reel_commentaires_profil = true where type = 'casting';
