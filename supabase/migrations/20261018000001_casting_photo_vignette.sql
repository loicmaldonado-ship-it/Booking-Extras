-- Photo choisie par l'équipe pour la vignette d'un profil dans un rôle
-- (Casting, lien réal, trombis et documents du casting). Vide = choix
-- automatique (essayage du projet, sinon portrait).
alter table public.casting_entries
  add column photo_vignette_id uuid references public.figurant_photos(id) on delete set null;
