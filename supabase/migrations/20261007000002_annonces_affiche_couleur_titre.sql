-- Couleur du titre de l'affiche, choisie à part du fond. null = automatique
-- (blanc ou noir selon la couleur du fond).
alter table public.annonces
  add column if not exists affiche_couleur_titre text check (affiche_couleur_titre ~ '^#[0-9A-Fa-f]{6}$');
