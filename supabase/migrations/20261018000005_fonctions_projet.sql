-- Fonctions enregistrées par projet (Passant, Client café…) : toute
-- fonction saisie quelque part (booking, besoins de journée, candidature)
-- s'y ajoute d'office, et est proposée ensuite dans les déroulants. Une
-- fonction déjà connue reprend son orthographe enregistrée (« passant » →
-- « Passant ») pour que les regroupements et les tris restent justes.
create table if not exists public.projet_fonctions (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists projet_fonctions_projet_nom_idx
  on public.projet_fonctions (projet_id, lower(nom));

alter table public.projet_fonctions enable row level security;
grant all on public.projet_fonctions to service_role;

-- Renvoie l'orthographe enregistrée de la fonction pour ce projet, en
-- l'enregistrant si elle est nouvelle.
create or replace function public.enregistrer_fonction_projet(p_projet uuid, p_nom text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := nullif(regexp_replace(trim(coalesce(p_nom, '')), '\s+', ' ', 'g'), '');
  v_existant text;
begin
  if v_nom is null or p_projet is null then
    return v_nom;
  end if;
  select nom into v_existant from projet_fonctions where projet_id = p_projet and lower(nom) = lower(v_nom);
  if v_existant is not null then
    return v_existant;
  end if;
  v_nom := upper(left(v_nom, 1)) || substr(v_nom, 2);
  insert into projet_fonctions (projet_id, nom) values (p_projet, v_nom) on conflict do nothing;
  return v_nom;
end;
$$;

create or replace function public.trg_bookings_fonction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.fonction := enregistrer_fonction_projet(new.projet_id, new.fonction);
  return new;
end;
$$;

create or replace function public.trg_besoins_fonction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.fonction := coalesce(
    enregistrer_fonction_projet((select projet_id from journees where id = new.journee_id), new.fonction),
    new.fonction
  );
  return new;
end;
$$;

create or replace function public.trg_candidatures_fonction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.fonction_assignee := enregistrer_fonction_projet(
    (select projet_id from annonces where id = new.annonce_id),
    new.fonction_assignee
  );
  return new;
end;
$$;

drop trigger if exists bookings_fonction_projet on public.bookings;
create trigger bookings_fonction_projet
  before insert or update of fonction on public.bookings
  for each row execute function public.trg_bookings_fonction();

drop trigger if exists besoins_fonction_projet on public.journee_besoins;
create trigger besoins_fonction_projet
  before insert or update of fonction on public.journee_besoins
  for each row execute function public.trg_besoins_fonction();

drop trigger if exists candidatures_fonction_projet on public.candidatures;
create trigger candidatures_fonction_projet
  before insert or update of fonction_assignee on public.candidatures
  for each row execute function public.trg_candidatures_fonction();

-- Reprise de l'existant : pour chaque projet, l'orthographe la plus
-- utilisée de chaque fonction, telle quelle (les bookings existants ne sont
-- pas modifiés et restent regroupés avec elle).
insert into public.projet_fonctions (projet_id, nom)
select distinct on (projet_id, lower(nom)) projet_id, nom
from (
  select projet_id, regexp_replace(trim(fonction), '\s+', ' ', 'g') as nom, count(*) as n
  from (
    select projet_id, fonction from public.bookings
    union all
    select j.projet_id, b.fonction from public.journee_besoins b join public.journees j on j.id = b.journee_id
    union all
    select a.projet_id, c.fonction_assignee from public.candidatures c join public.annonces a on a.id = c.annonce_id
  ) toutes
  where fonction is not null and trim(fonction) <> ''
  group by 1, 2
) comptes
order by projet_id, lower(nom), n desc
on conflict do nothing;
