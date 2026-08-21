alter table public.projets
  add column if not exists covoiturage_tarif_base numeric(6,2) not null default 15,
  add column if not exists covoiturage_tarif_passager numeric(6,2) not null default 5;
