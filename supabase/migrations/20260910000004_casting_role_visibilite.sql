-- Permet de masquer un rôle (typiquement une silhouette) du lien de
-- partage réal sans le supprimer ni retirer les profils déjà castés.
alter table public.casting_roles add column if not exists visible_partage boolean not null default true;
