-- Nouveau type de notification : un candidat a envoyé sa vidéo/photos pour
-- un casting (voir finalizeCastingUpload).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('candidature', 'reponse', 'compte_cree', 'casting'));
