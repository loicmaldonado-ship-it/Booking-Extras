-- Style du texte de l'affiche (infos + description), à part du titre.
-- null = police du site, couleur automatique, taille normale.
alter table public.annonces
  add column if not exists affiche_police_corps text,
  add column if not exists affiche_couleur_corps text check (affiche_couleur_corps ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists affiche_taille_corps text check (affiche_taille_corps in ('normal', 'grand', 'tres-grand'));
