-- Lien réal du casting : un lien « tout le casting » (comme avant) et, au
-- choix, un lien par catégorie (rôles, silhouettes, doublures), chacun avec
-- ses propres réglages (infos montrées, avis, commentaires, documents).
-- categorie null = tout le casting.
alter table public.partage_liens
  add column if not exists categorie text check (categorie in ('role', 'silhouette', 'doublure'));

alter table public.partage_liens drop constraint if exists partage_liens_categorie_casting_check;
alter table public.partage_liens
  add constraint partage_liens_categorie_casting_check check (categorie is null or type = 'casting');

-- Un lien par projet, par type et par catégorie (au lieu d'un par projet et par type).
alter table public.partage_liens drop constraint if exists partage_liens_projet_id_type_key;
create unique index if not exists partage_liens_projet_type_categorie_idx
  on public.partage_liens (projet_id, type, coalesce(categorie, ''));
