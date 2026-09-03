-- Sur le lien réal, permet de masquer téléphone/email (comédien·ne et
-- agent) des fiches rôles validés — indépendant de la visibilité du
-- document lui-même (fiches_roles_visible).
alter table public.partage_liens add column if not exists fiches_roles_masquer_contact boolean not null default false;
