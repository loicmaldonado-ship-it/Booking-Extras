-- Deux documents casting (liste artistique, fiches rôles validés) que le
-- staff peut choisir de rendre visibles/téléchargeables sur le lien de
-- partage réal — indépendant des profils/rôles marqués visibles un par un,
-- puisque ces docs listent les rôles dans leur ensemble plutôt qu'un profil
-- précis. Colonnes portées par le lien casting lui-même (type='casting'),
-- sans intérêt pour les autres types de partage_liens.
alter table public.partage_liens add column if not exists liste_artistique_visible boolean not null default false;
alter table public.partage_liens add column if not exists fiches_roles_visible boolean not null default false;
