-- Photos et vidéos retirées du lien réal, profil par profil. La liste contient
-- « p:<id de la photo> » ou « v:<chemin de la vidéo> » : rien n'est supprimé,
-- le média reste dans la fiche et chez l'équipe, il n'est juste plus montré au
-- réal tant qu'on ne le remet pas.
alter table public.casting_entries
  add column if not exists medias_masques text[] not null default '{}';
