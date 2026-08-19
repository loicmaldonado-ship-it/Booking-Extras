-- Modèles de base à partir des messages réels fournis, généralisés avec les
-- tokens {prenom}/{projet}/{date}/{lieu}/{cachet}/{fonction}/{signature}.
insert into public.message_templates (nom, sujet, corps)
select 'Refus de candidature', 'Concernant votre candidature', $body$Bonjour {prenom},

Pour le projet '{projet}' 👇🏻

Votre profil n'a malheureusement pas été retenu :/
Nous tenions néanmoins à vous remercier pour votre implication !

Vous souhaitant une belle suite et à bientôt !

{signature}$body$
where not exists (select 1 from public.message_templates where nom = 'Refus de candidature');

insert into public.message_templates (nom, sujet, corps)
select 'Proposition rôle / silhouette', 'Proposition pour {projet}', $body$Bonjour {prenom},

Pour le projet '{projet}' 👇🏻

Nous aimerions vous proposer votre profil pour [rôle/fonction à préciser]

Date : {date}
Lieu : {lieu}
Cachet : {cachet}

Si vous êtes partant•e :
Merci de répondre OK DISPO et d'envoyer un lien vers votre bande démo ou une scène où on vous voit jouer.
Si pas intéressé·e, merci de répondre PAS DISPO.

Belle journée,

{signature}$body$
where not exists (select 1 from public.message_templates where nom = 'Proposition rôle / silhouette');

insert into public.message_templates (nom, sujet, corps)
select 'Proposition de booking', 'Proposition de tournage — {projet}', $body$Bonjour {prenom},
! MERCI DE LIRE CE MAIL EN ENTIER !

Pour le projet '{projet}', nous souhaitons vous proposer une date de figuration en tant que {fonction}.

Date de tournage : {date}
Lieu : {lieu}
Cachet : {cachet}

Si vous êtes dispo, merci de répondre à ce mail pour confirmer et de bien bloquer toute la journée (+ la soirée en cas d'heures supplémentaires).
Si vous n'êtes pas dispo, merci de répondre pour nous le signaler.

ADMINISTRATIF -> merci de vous inscrire administrativement au plus vite sur Myrole pour votre future embauche : [lien Myrole à compléter]

Votre réponse à ce mail vaut confirmation pour le tournage :)

N'hésitez pas à nous contacter si vous avez des questions.

Au plaisir de vous retrouver ou de vous rencontrer !

À très vite !

{signature}$body$
where not exists (select 1 from public.message_templates where nom = 'Proposition de booking');
