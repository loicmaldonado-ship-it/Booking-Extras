-- Profil "comédien·ne" : identité/contact/adresse/photo ne sont plus
-- obligatoires à la création (contrairement aux profils figurant·es), et
-- coordonnées d'agent rattachées directement à la fiche — l'agent
-- représente la personne, pas une entrée de casting précise.
alter table public.figurants
  add column if not exists est_comedien boolean not null default false,
  add column if not exists agent_nom text,
  add column if not exists agent_email text,
  add column if not exists agent_telephone text;
