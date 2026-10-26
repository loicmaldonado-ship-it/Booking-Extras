-- Candidatures comme un classeur :
--  1. chaque date d'annonce a son onglet de journée (une seule place par
--     profil : Retenu, Peut-être, une journée…) ;
--  2. des étiquettes (Vélo, Gueules…) qu'on colle sans changer de place ;
--  3. la réserve : profils mis de côté sur un projet, à recontacter.
-- « Ok dispo » disparaît (jamais utilisé).

-- ---------- 1. Onglets de journée ----------

alter table public.candidature_onglets
  add column if not exists annonce_date_id uuid references public.annonce_dates (id) on delete cascade;
create unique index if not exists candidature_onglets_annonce_date_idx
  on public.candidature_onglets (annonce_date_id) where annonce_date_id is not null;

create or replace function public.nom_onglet_journee(d date) returns text
language sql immutable as $$
  select (array['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'])[extract(dow from d)::int + 1] || ' ' || to_char(d, 'DD/MM')
$$;

-- Les onglets de journée suivent les dates de l'annonce : créés avec la
-- date, renommés si elle change, supprimés avec elle (les profils qui y
-- étaient retournent dans « À trier »). Pas pour une annonce « indispos sur
-- calendrier » (période de plusieurs dizaines de jours) : pas d'onglets.
create or replace function public.sync_onglet_journee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.annonces where id = new.annonce_id and dispos_par_calendrier) then
      insert into public.candidature_onglets (nom, couleur, fixe, ordre, annonce_id, annonce_date_id)
      values (public.nom_onglet_journee(new.date), 'default', false, 100000 + (new.date - date '2020-01-01'), new.annonce_id, new.id)
      on conflict do nothing;
    end if;
  else
    update public.candidature_onglets
    set nom = public.nom_onglet_journee(new.date), ordre = 100000 + (new.date - date '2020-01-01')
    where annonce_date_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists annonce_dates_onglet_journee on public.annonce_dates;
create trigger annonce_dates_onglet_journee
  after insert or update of date on public.annonce_dates
  for each row execute function public.sync_onglet_journee();

-- Passage en mode « indispos sur calendrier » : les onglets de journée
-- disparaissent ; retour au mode normal : ils sont recréés.
create or replace function public.sync_onglets_journees_annonce() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.dispos_par_calendrier then
    delete from public.candidature_onglets where annonce_id = new.id and annonce_date_id is not null;
  else
    insert into public.candidature_onglets (nom, couleur, fixe, ordre, annonce_id, annonce_date_id)
    select public.nom_onglet_journee(d.date), 'default', false, 100000 + (d.date - date '2020-01-01'), d.annonce_id, d.id
    from public.annonce_dates d
    where d.annonce_id = new.id
      and not exists (select 1 from public.candidature_onglets o where o.annonce_date_id = d.id);
  end if;
  return new;
end;
$$;

drop trigger if exists annonces_onglets_journees on public.annonces;
create trigger annonces_onglets_journees
  after update of dispos_par_calendrier on public.annonces
  for each row when (old.dispos_par_calendrier is distinct from new.dispos_par_calendrier)
  execute function public.sync_onglets_journees_annonce();

insert into public.candidature_onglets (nom, couleur, fixe, ordre, annonce_id, annonce_date_id)
select public.nom_onglet_journee(d.date), 'default', false, 100000 + (d.date - date '2020-01-01'), d.annonce_id, d.id
from public.annonce_dates d
join public.annonces a on a.id = d.annonce_id and not a.dispos_par_calendrier
where not exists (select 1 from public.candidature_onglets o where o.annonce_date_id = d.id);

-- Sauvegarde du rangement d'avant, pour pouvoir revenir en arrière.
create table if not exists public.sauvegarde_onglets_avant_journees (
  candidature_id uuid primary key,
  onglet_avant uuid
);
alter table public.sauvegarde_onglets_avant_journees enable row level security;
grant all on public.sauvegarde_onglets_avant_journees to service_role;

-- Les profils rangés dans une journée (ancien « dans la journée ») prennent
-- l'onglet de cette journée ; sur plusieurs journées, la première. OUT reste.
insert into public.sauvegarde_onglets_avant_journees (candidature_id, onglet_avant)
select c.id, c.onglet_id
from public.candidatures c
where c.id in (select candidature_id from public.candidature_jours)
on conflict do nothing;

update public.candidatures c
set onglet_id = x.onglet_id
from (
  select distinct on (cj.candidature_id) cj.candidature_id, o.id as onglet_id
  from public.candidature_jours cj
  join public.annonce_dates d on d.id = cj.annonce_date_id
  join public.candidature_onglets o on o.annonce_date_id = d.id
  order by cj.candidature_id, d.date
) x
where c.id = x.candidature_id
  and (c.onglet_id is null or c.onglet_id not in (select id from public.candidature_onglets where fixe));

-- ---------- « Ok dispo » ----------

update public.candidatures
set onglet_id = null
where onglet_id in (select id from public.candidature_onglets where nom = 'Ok dispo' and not fixe);
delete from public.candidature_onglets where nom = 'Ok dispo' and not fixe;

-- ---------- 2. Étiquettes ----------

create table if not exists public.candidature_etiquettes (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists candidature_etiquettes_nom_idx on public.candidature_etiquettes (projet_id, lower(nom));

create table if not exists public.candidature_etiquette_liens (
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  etiquette_id uuid not null references public.candidature_etiquettes (id) on delete cascade,
  primary key (candidature_id, etiquette_id)
);
create index if not exists candidature_etiquette_liens_etiquette_idx on public.candidature_etiquette_liens (etiquette_id);

alter table public.candidature_etiquettes enable row level security;
alter table public.candidature_etiquette_liens enable row level security;

drop policy if exists "scoped by projet" on public.candidature_etiquettes;
create policy "scoped by projet" on public.candidature_etiquettes for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

drop policy if exists "scoped by projet" on public.candidature_etiquette_liens;
create policy "scoped by projet" on public.candidature_etiquette_liens for all to authenticated
  using (exists (select 1 from public.candidature_etiquettes e where e.id = etiquette_id and public.has_projet_access(e.projet_id)))
  with check (exists (select 1 from public.candidature_etiquettes e where e.id = etiquette_id and public.has_projet_access(e.projet_id)));

grant all on public.candidature_etiquettes, public.candidature_etiquette_liens to service_role, authenticated;

-- ---------- 3. Réserve ----------

create table if not exists public.reserve_profils (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  -- Candidature d'origine : où il a postulé et ses dispos (null si ajouté
  -- sans candidature).
  candidature_id uuid references public.candidatures (id) on delete set null,
  mis_par uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (projet_id, figurant_id)
);
create index if not exists reserve_profils_projet_idx on public.reserve_profils (projet_id);

alter table public.reserve_profils enable row level security;
drop policy if exists "scoped by projet" on public.reserve_profils;
create policy "scoped by projet" on public.reserve_profils for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
grant all on public.reserve_profils to service_role, authenticated;
