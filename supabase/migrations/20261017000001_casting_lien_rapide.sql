-- Lien rapide de casting : un lien public par rôle, à envoyer à plusieurs
-- personnes. Chacune se connecte (ou crée son compte) puis envoie les
-- photos / vidéos demandées par le rôle — sa fiche casting se crée seule.
alter table public.casting_roles
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists lien_public_actif boolean not null default true;
create unique index if not exists casting_roles_public_token_idx on public.casting_roles (public_token);
