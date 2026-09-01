-- Date limite d'envoi des selftapes (vidéos/photos), calibrable par rôle —
-- affichée sur la carte du profil et dans le mail d'invitation, bloque
-- l'envoi côté candidat une fois passée.
alter table public.casting_roles add column if not exists date_limite_envoi date;
