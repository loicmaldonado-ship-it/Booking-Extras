-- Bibliothèque « prête à l'emploi », commune à toutes les équipes
-- (equipe_id null) : modèles de messages et questions d'annonce écrits à
-- partir des messages réellement envoyés, généralisés (aucun nom, lieu ni
-- numéro). En lecture seule ; chaque équipe peut les copier pour les
-- personnaliser.

-- Les quatre modèles d'origine jamais modifiés sont remplacés par cette
-- bibliothèque (versions équivalentes ou plus complètes).
delete from public.message_templates
where equipe_id is not null
  and nom in ('Relance sans réponse', 'Refus de candidature', 'Proposition rôle / silhouette', 'Proposition de booking')
  and updated_at = created_at;

-- « \n » enregistrés en toutes lettres (envoyés tels quels aux figurant·es).
update public.message_templates
set corps = replace(corps, '\n', E'\n')
where corps like '%\n%';

insert into public.message_templates (nom, sujet, corps, equipe_id) values
('Booking · Proposition de date', 'Proposition de tournage – {projet}', $b$Bonjour {prenom},

Pour le projet « {projet} », nous souhaitons vous proposer une journée de tournage en tant que {fonction}.

Date : {date}
Lieu : {lieu}
Cachet : {cachet}

Si vous êtes disponible, merci de répondre à ce message avec OK DISPO + NOM + PRÉNOM et de bloquer toute la journée (prévoyez aussi la soirée en cas d'heures supplémentaires).
Si vous n'êtes pas disponible, merci de nous le signaler.

Votre réponse vaut confirmation pour le tournage. Vous recevrez la veille un message avec l'heure de convocation et l'adresse exacte.

Administratif : merci de vous inscrire au plus vite sur Myrole pour votre embauche.

N'hésitez pas à nous contacter si vous avez des questions.

À très vite !

{signature}$b$, null),

('Booking · Proposition figuration bénévole', 'Proposition de tournage – {projet}', $b$Bonjour {prenom},

Merci pour votre intérêt pour le projet « {projet} » ! Nous sommes ravis de vous proposer une journée de figuration bénévole en tant que {fonction}.

Date : {date}
Lieu : {lieu} (adresse exacte confirmée la veille)

Si vous êtes disponible, merci de répondre à ce message pour confirmer et de bloquer la journée entière.
Si vous n'êtes pas disponible, merci de nous le signaler.

Votre réponse vaut confirmation pour le tournage. Vous recevrez la veille un message avec l'heure de convocation et l'adresse définitive.

🍽️ Un repas est prévu pour vous le jour du tournage.

Tenues : merci d'apporter 2 propositions adaptées à la météo :
- 1 tenue qui vous ressemble, où vous exprimez votre personnalité
- 1 tenue plus sobre, de tous les jours
Pas de look entièrement noir, pas de marques ou logos trop apparents.

Au plaisir de vous retrouver sur le tournage !

{signature}$b$, null),

('Booking · Convocation (veille du tournage)', 'Convocation – {projet} – {date}', $b$Bonjour {prenom},

Voici votre convocation pour le tournage de « {projet} » :

📅 {date}
🕗 Convocation à [heure] précises
📍 {lieu}

Votre fonction : {fonction}
Fin de journée prévue vers [heure].
Repas : [prévu sur place / à apporter]

Tenues : merci de venir déjà habillé·e dans une de vos propositions et d'apporter l'autre :
- 1 tenue qui vous ressemble
- 1 tenue plus sobre, de tous les jours
Pas de look entièrement noir, pas de marques ou logos trop apparents.
Accessoires : [parapluie, sac…]

Sur place, vous pourrez contacter : [nom et téléphone]

Nous avons à cœur la bienveillance entre figurant·es, comédien·nes et équipe technique. Si vous êtes victime ou témoin d'un comportement déplacé sur le tournage, merci de nous en faire part.

MERCI D'ACCUSER RÉCEPTION AVEC VOTRE NOM ET PRÉNOM.

À très vite !

{signature}$b$, null),

('Booking · Rappel de date', 'Rappel – tournage {projet}', $b$Bonjour {prenom},

Petit rappel : vous êtes booké·e pour le tournage de « {projet} » le {date}.

Fonction : {fonction}
Lieu : {lieu}
Cachet : {cachet}

Merci de bien noter la date et de nous prévenir au plus vite en cas d'empêchement.

À très vite !

{signature}$b$, null),

('Booking · Relance sans réponse', 'Nous attendons votre réponse – {projet}', $b$Bonjour {prenom},

Nous n'avons pas encore reçu votre réponse pour le tournage de « {projet} » ({date}).
Pouvez-vous nous confirmer rapidement si vous êtes disponible (OK DISPO) ou non (PAS DISPO) ?

Merci !

{signature}$b$, null),

('Booking · Changement de date', 'Changement de date – {projet}', $b$Bonjour {prenom},

La date de tournage de « {projet} » a changé. Afin de proposer votre profil, pouvez-vous nous dire si vous êtes :

- DISPO pour le tournage le [nouvelle date]
- DISPO pour un essayage costume le [date(s)]

Merci de répondre rapidement : OK DISPO ou PAS DISPO.

{signature}$b$, null),

('Infos pratiques d''accès', 'Infos pratiques – {projet}', $b$Bonjour {prenom},

Voici les informations pour accéder au lieu :

📍 {lieu}
🚇 Transports : [métro / bus le plus proche, temps à pied]
🔑 Code d'entrée : [code]
🚪 [étage, porte, personne à demander]

En cas de difficulté, appelez-nous au [téléphone].

À très vite !

{signature}$b$, null),

('Candidature · Non retenue', 'Votre candidature – {projet}', $b$Bonjour {prenom},

Merci pour votre candidature pour le projet « {projet} ».
Votre profil n'a malheureusement pas été retenu cette fois-ci, mais nous gardons vos informations pour de prochains tournages.

Merci encore pour votre intérêt et à bientôt !

{signature}$b$, null),

('Casting · Demande de selftape', 'Casting « {role} » – {projet}', $b$Bonjour {prenom},

L'équipe de casting du projet « {projet} » vous propose de passer un casting en selftape pour le rôle « {role} ».

Merci de nous envoyer vos vidéos et photos via ce lien :
{lien}

Date limite d'envoi : {deadline}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.

Belle journée,

{signature}$b$, null),

('Casting · Proposition silhouette / doublure', 'Proposition – {projet}', $b$Bonjour {prenom},

Pour le projet « {projet} », nous souhaitons proposer votre profil au réalisateur·ice pour « {role} ».

Dates : {date}
Lieu : {lieu}
Cachet : [montant et majorations]
Transport / hébergement : [pris en charge ou non]

Si vous êtes disponible et partant·e, merci de répondre rapidement OK DISPO, puis d'envoyer vos photos via ce lien :
{lien}

Merci de répondre avant le {deadline}.

N'hésitez pas à nous appeler si besoin.

{signature}$b$, null),

('Casting · Proposition de rôle (bande démo)', 'Proposition pour {projet}', $b$Bonjour {prenom},

Pour le projet « {projet} », nous aimerions vous proposer pour le rôle « {role} ».

Dates : {date}
Lieu : {lieu}

Si vous êtes partant·e, merci de répondre OK DISPO et d'envoyer un lien vers votre bande démo ou une scène où l'on vous voit jouer.
Si vous n'êtes pas intéressé·e, merci de répondre PAS DISPO.

Belle journée,

{signature}$b$, null),

('Casting · Rendez-vous confirmé', 'Rendez-vous casting – {role}', $b$Bonjour {prenom},

Votre rendez-vous de casting pour le rôle « {role} » sur « {projet} » est confirmé :
{horaire}
{lieu}

Vous trouverez en pièce jointe le texte à préparer.

Merci de vous présenter à l'heure indiquée. N'hésitez pas à nous contacter si vous avez des questions.

À très vite !

{signature}$b$, null),

('Casting · Non retenu·e après casting', 'Casting « {role} » – {projet}', $b$Bonjour {prenom},

Merci d'avoir passé le casting pour le rôle « {role} » sur « {projet} ».
Votre profil n'a malheureusement pas été retenu cette fois-ci. Toute l'équipe vous remercie chaleureusement pour votre intérêt et la qualité de votre travail.

Nous espérons vous revoir très vite pour un prochain casting et vous souhaitons une belle suite dans vos projets.

À bientôt !

{signature}$b$, null),

('Casting · Pas retenu·e, venir en figuration ?', 'Casting « {role} » – {projet}', $b$Bonjour {prenom},

Merci encore pour votre casting pour le rôle « {role} ». Le choix s'est finalement porté sur un autre profil, mais nous serions ravis de vous accueillir sur le tournage en tant que figurant·e.

Si vous êtes intéressé·e et disponible ({date}), répondez-nous et nous vous enverrons toutes les infos.

À très vite !

{signature}$b$, null);

-- Questions d'annonce prêtes à l'emploi.
alter table public.question_templates drop constraint if exists question_templates_equipe_label_idx;
drop index if exists public.question_templates_equipe_label_idx;
create unique index if not exists question_templates_equipe_label_idx
  on public.question_templates (equipe_id, label) nulls not distinct;

insert into public.question_templates (label, equipe_id) values
('Avez-vous un vélo ?', null),
('Avez-vous une voiture ?', null),
('Avez-vous le permis B ?', null),
('Avez-vous une expérience en service et/ou en cuisine ? Laquelle ?', null),
('Acceptez-vous de couper vos cheveux et/ou votre barbe si besoin ?', null),
('Êtes-vous disponible pour un essayage costume avant le tournage ?', null),
('Avez-vous des tatouages visibles ? Où ?', null),
('Avez-vous une expérience en maniement d''arme, service militaire ou cascade ?', null),
('Savez-vous danser ? Quel style ?', null),
('Parlez-vous une langue étrangère ? Laquelle ?', null),
('Savez-vous nager ?', null),
('Acceptez-vous de fumer à l''image (cigarette factice) ?', null),
('Pouvez-vous venir avec votre propre tenue spécifique (uniforme, costume…) ?', null),
('Pouvez-vous venir avec votre animal de compagnie ?', null)
on conflict do nothing;
