-- Les vidéos du casting partent désormais telles quelles (plus de
-- compression dans le navigateur) : une vidéo d'iPhone 4K de quelques
-- minutes peut dépasser 500 Mo. Limite du bucket portée à 2 Go.
-- (La limite globale du projet, réglée dans le tableau de bord Supabase
-- → Storage → Settings, doit être au moins aussi haute.)
update storage.buckets
set file_size_limit = 2147483648
where id = 'casting-videos';
