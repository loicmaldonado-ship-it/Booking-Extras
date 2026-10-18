-- Visites et commentaires sur tous les liens de partage (étape 3) : lien
-- réal du casting, documents, essayages (partage_liens) et liens d'une
-- journée (partage_journee_liens), en plus des liens de validation.

alter table public.partage_visites drop constraint partage_visites_lien_type_check;
alter table public.partage_visites add constraint partage_visites_lien_type_check
  check (lien_type in ('validation', 'casting', 'documents', 'essayages', 'journee'));

alter table public.partage_commentaires drop constraint partage_commentaires_lien_type_check;
alter table public.partage_commentaires add constraint partage_commentaires_lien_type_check
  check (lien_type in ('validation', 'casting', 'documents', 'essayages', 'journee'));

-- Notification « partage » : commentaire laissé sur un lien partagé.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['candidature', 'reponse', 'compte_cree', 'casting', 'validation', 'partage']));
