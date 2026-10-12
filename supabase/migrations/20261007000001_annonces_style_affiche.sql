-- Style de l'affiche d'une annonce, choisi dans le formulaire de l'annonce
-- avec un aperçu en direct. null = style d'origine (fond corail sans photo,
-- voile noir, texte blanc, police Space Grotesk).
alter table public.annonces
  add column if not exists affiche_couleur text check (affiche_couleur ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists affiche_police text;
