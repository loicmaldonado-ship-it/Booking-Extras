-- Coordonnées d'agent sur une entrée de casting — pertinent surtout pour
-- les rôles (categorie_cachet = 'role'), où l'acteur·rice est souvent
-- représenté·e par un agent à contacter en plus (ou à la place) du profil.
alter table public.casting_entries
  add column if not exists agent_nom text,
  add column if not exists agent_email text,
  add column if not exists agent_telephone text;
