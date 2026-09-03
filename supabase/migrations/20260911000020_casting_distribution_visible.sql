-- Troisième document casting partageable sur le lien réal, même principe
-- que liste_artistique_visible/fiches_roles_visible.
alter table public.partage_liens add column if not exists distribution_visible boolean not null default false;
