-- Un remplacement Storage peut modifier metadata/version sans SET name.
-- Le verrou doit s’appliquer à toute écriture, y compris un ancien lien upsert.
drop trigger rgpd_storage_subject on storage.objects;
create trigger rgpd_storage_subject before insert or update on storage.objects
for each row execute function public.rgpd_block_storage_write();
