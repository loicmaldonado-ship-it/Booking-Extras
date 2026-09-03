-- Ordre d'affichage choisi par le staff (ex. Farah en rôle n°1 avant
-- Chauffeur de Taxi en n°12), indépendant de la date de tournage ou de la
-- date de création — initialisé à la date de création pour garder l'ordre
-- actuel des rôles existants.
alter table public.casting_roles add column if not exists ordre integer;

update public.casting_roles set ordre = sub.rn
from (
  select id, row_number() over (partition by projet_id order by created_at) as rn
  from public.casting_roles
) sub
where public.casting_roles.id = sub.id and public.casting_roles.ordre is null;

alter table public.casting_roles alter column ordre set not null;
alter table public.casting_roles alter column ordre set default 0;
