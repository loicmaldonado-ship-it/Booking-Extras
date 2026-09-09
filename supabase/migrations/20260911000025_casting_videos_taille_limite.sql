-- La limite par défaut du projet (50 Mio) rejette parfois un envoi côté
-- Supabase Storage même quand la compression a fait de son mieux — soit
-- parce qu'elle a échoué silencieusement sur ce navigateur (fichier
-- d'origine envoyé tel quel), soit parce que le meilleur résultat obtenu
-- (voir hardCapBytes dans compress-video.ts, ~40 Mo) reste au-dessus de
-- cette limite une fois l'en-tête HTTP ajouté. Relève la limite du bucket
-- casting-videos spécifiquement, avec une marge confortable au-dessus de
-- ce que la compression peut produire au pire — pas une invitation à
-- envoyer des fichiers énormes, juste de l'air pour ne pas rejeter un
-- envoi déjà réduit du mieux possible.
update storage.buckets set file_size_limit = 209715200 -- 200 MiB
where id = 'casting-videos';
