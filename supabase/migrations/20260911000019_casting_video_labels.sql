-- Nom libre par vidéo (ex: "Essai 1", "Vidéo de présentation"), aligné par
-- index avec video_storage_paths plutôt qu'un objet {path,label} : évite de
-- changer le type de colonne existant, même principe que photo_labels.
alter table public.casting_entries add column video_labels text[] not null default '{}';
