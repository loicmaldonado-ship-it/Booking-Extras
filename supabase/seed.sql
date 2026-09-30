-- Données de test pour la base LOCALE uniquement : rechargées à chaque
-- `npx supabase db reset` (voir [db.seed] dans config.toml). Jamais
-- appliquées en production (`db push` n'exécute pas ce fichier).
--
-- Comptes de test (même mot de passe partout : booking-test)
--   Équipe (se connecter sur /login) :
--     cheffe.test@test-chat-charge.fr      cheffe, compte propriétaire
--     assistante.test@test-chat-charge.fr  assistante, invitée sur le projet de test
--   Candidat·e (se connecter sur /compte/connexion) :
--     candidate.test@test-figurant.fr      candidate existante, a déjà postulé
--   Nouveau candidat : postuler avec une nouvelle adresse sur
--     /postuler/00000000-0000-4000-8000-00000000a0a0
--
-- Les emails ne partent pas en local tant que GMAIL_SMTP_* est vide.

-- Comptes équipe (Supabase Auth). Le trigger handle_new_auth_user crée le
-- profil ; le rôle et la fiche sont fixés juste après.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c0c0', 'authenticated', 'authenticated',
   'cheffe.test@test-chat-charge.fr', extensions.crypt('booking-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000a551', 'authenticated', 'authenticated',
   'assistante.test@test-chat-charge.fr', extensions.crypt('booking-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in ('00000000-0000-4000-8000-00000000c0c0', '00000000-0000-4000-8000-00000000a551');

-- La fiche membre complète (photo comprise) est exigée des cheffes : le
-- chemin d'avatar n'a pas de fichier derrière, l'image sera juste vide.
update public.profiles
set role = 'chef', is_owner = true, prenom = 'Camille', nom = 'Cheffe-Test', telephone = '0600000001',
    avatar_storage_path = 'seed/avatar-cheffe.png'
where id = '00000000-0000-4000-8000-00000000c0c0';

update public.profiles
set role = 'assistant', prenom = 'Alex', nom = 'Assistante-Test', telephone = '0600000002'
where id = '00000000-0000-4000-8000-00000000a551';

-- Un projet, partagé avec l'assistante, et une annonce ouverte avec deux
-- dates et une question.
insert into public.projets (id, nom, owner_id, lieu)
values ('00000000-0000-4000-8000-0000000070e0', 'Projet de test', '00000000-0000-4000-8000-00000000c0c0', 'Paris');

insert into public.projet_membres (projet_id, profile_id)
values ('00000000-0000-4000-8000-0000000070e0', '00000000-0000-4000-8000-00000000a551');

insert into public.annonces (id, projet_id, titre, description, statut, public_token, types_cachet, lieu)
values ('00000000-0000-4000-8000-00000000a000', '00000000-0000-4000-8000-0000000070e0', 'Annonce de test',
        'Figuration dans un café parisien.

Tenue de ville, pas de logo.', 'ouverte', '00000000-0000-4000-8000-00000000a0a0', '{Figurant}', 'Paris');

insert into public.annonce_dates (id, annonce_id, date) values
  ('00000000-0000-4000-8000-00000000da01', '00000000-0000-4000-8000-00000000a000', current_date + 14),
  ('00000000-0000-4000-8000-00000000da02', '00000000-0000-4000-8000-00000000a000', current_date + 15);

insert into public.annonce_questions (id, annonce_id, label)
values ('00000000-0000-4000-8000-00000000a0e1', '00000000-0000-4000-8000-00000000a000', 'As-tu une tenue de soirée ?');

-- Candidate existante : espace perso activé, mot de passe "booking-test"
-- (hash scrypt, même format que src/lib/candidats/password.ts), et une
-- candidature sur l'annonce de test.
insert into public.figurants (
  id, prenom, nom, email, telephone, genre, pronom, date_naissance, adresse, code_postal, ville,
  commune_naissance, taille_cm, poids_kg, pointure, veste, pantalon, acces_compte, password_hash
) values (
  '00000000-0000-4000-8000-00000000f001', 'Sacha', 'Candidate-Test', 'candidate.test@test-figurant.fr', '0600000003',
  'Femme', 'Elle', '1995-06-15', '1 rue de Test', '75011', 'Paris', 'Lyon', 168, 60, 38, '38', '38', true,
  '06f49f5d2d8223a96f38abafaefc2919:9e1542dc0918657e0eab7b090c2bea4152532f59e3bdb0b2431b2a2944a2660d288ae6ced798f80c2de49290b93ed5cfe6c5a1c36573f421a6b862e7eeb32cb0'
);

insert into public.candidatures (id, figurant_id, annonce_id, message)
values ('00000000-0000-4000-8000-00000000cd01', '00000000-0000-4000-8000-00000000f001',
        '00000000-0000-4000-8000-00000000a000', 'Bonjour, je suis disponible les deux jours.');

insert into public.candidature_disponibilites (candidature_id, annonce_date_id, disponible) values
  ('00000000-0000-4000-8000-00000000cd01', '00000000-0000-4000-8000-00000000da01', true),
  ('00000000-0000-4000-8000-00000000cd01', '00000000-0000-4000-8000-00000000da02', true);

insert into public.candidature_reponses (candidature_id, annonce_question_id, reponse)
values ('00000000-0000-4000-8000-00000000cd01', '00000000-0000-4000-8000-00000000a0e1', true);
