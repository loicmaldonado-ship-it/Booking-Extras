-- Fiche membre pour les cheffes de casting : prénom + téléphone (nom et
-- email existaient déjà), et deux modèles d'email automatique calibrables
-- par cheffe (activation espace perso, renvoi du lien de connexion) — vide
-- = texte par défaut généré par l'appli, comme message_corps sur les rôles
-- de casting.
alter table public.profiles add column if not exists prenom text;
alter table public.profiles add column if not exists telephone text;
alter table public.profiles add column if not exists email_espace_perso_template text;
alter table public.profiles add column if not exists email_magic_link_template text;
