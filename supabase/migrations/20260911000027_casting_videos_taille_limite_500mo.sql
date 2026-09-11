-- Relevé une première fois à 200 Mio (voir 20260911000025). Avec le repli
-- sur fichier original quand la compression dépasse son budget (voir
-- compress-and-upload-video.ts) ou échoue simplement, un original 4K non
-- compressé peut dépasser 200 Mio sur un selftape un peu long — marge
-- supplémentaire pour ne pas transformer un repli sain en nouvel échec.
update storage.buckets set file_size_limit = 524288000 -- 500 MiB
where id = 'casting-videos';
