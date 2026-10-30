-- SEC-03 (Storage, 30/10/2026) : les espaces publics étaient LISTABLES par n'importe qui avec la clé publique
-- (énumération de tous les avatars, médias d'annonce, logos de documents de production et affiches, et des
-- identifiants contenus dans leurs chemins). Un espace marqué public sert ses fichiers par /object/public/... sans
-- aucune policy : ces policies SELECT ne servaient qu'au listing et à la lecture authentifiée, que l'application
-- n'utilise pas (tous les listings et suppressions passent par service_role).
begin;
drop policy if exists "public read annonce medias" on storage.objects;
drop policy if exists "public read document templates" on storage.objects;
drop policy if exists "public read profile avatars" on storage.objects;
drop policy if exists "public read references affiches" on storage.objects;
commit;
