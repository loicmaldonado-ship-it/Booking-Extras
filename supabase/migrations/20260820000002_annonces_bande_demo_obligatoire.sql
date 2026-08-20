alter table public.annonces
  add column if not exists bande_demo_obligatoire boolean not null default false;
