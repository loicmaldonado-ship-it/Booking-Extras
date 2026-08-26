-- Nouvelle catégorie de message interne pour l'équipe habillage / maquillage
-- / coiffure.
alter table public.figurant_messages drop constraint if exists figurant_messages_categorie_check;
alter table public.figurant_messages add constraint figurant_messages_categorie_check
  check (categorie in ('booking', 'convocation', 'covoiturage', 'essayage', 'casting', 'hmc', 'libre', 'espace_perso'));
