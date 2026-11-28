-- Photos qu'on ne veut pas voir dans les documents du casting (liste artistique,
-- fiches rôles, distribution, fiches mensuration), profil par profil. Liste des
-- ids de photos : rien n'est supprimé, la photo reste dans la fiche et peut
-- toujours servir ailleurs (ex. sur le lien réal).
alter table public.casting_entries
  add column if not exists photos_exclues_docs text[] not null default '{}';
