-- Visibilité par profil sur le lien de partage réal — jusqu'ici, une vidéo
-- envoyée par le candidat apparaissait AUTOMATIQUEMENT au réal dès l'envoi
-- (filtre sur submitted_at seul), sans relecture possible côté staff.
-- Décorrélé : submitted_at reste "la personne a tout envoyé", ce nouveau
-- champ devient le vrai interrupteur "le réal peut la voir" — à activer à la
-- main une fois le contenu vérifié. Défaut à false pour les nouveaux
-- profils (revue avant exposition) ; les profils déjà envoyés à ce jour
-- restent visibles pour ne pas casser un lien réal déjà en cours d'usage.
alter table public.casting_entries add column if not exists visible_partage boolean not null default false;
update public.casting_entries set visible_partage = true where submitted_at is not null;
