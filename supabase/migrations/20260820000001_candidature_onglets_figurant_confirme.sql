-- Onglets de rangement pour les candidatures : remplace le statut fixe
-- (en_attente/retenu/refuse) par des colonnes souples que le staff peut
-- créer/renommer/supprimer. "OUT BE" est un onglet spécial (fixe=true,
-- rouge) : y placer un profil le fait disparaître de la vue Candidatures,
-- comme le fait déjà le transfert vers une journée.
create table if not exists public.candidature_onglets (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  couleur text not null default 'default' check (couleur in ('default', 'coral', 'turquoise', 'yellow', 'danger')),
  fixe boolean not null default false,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.candidature_onglets (nom, couleur, fixe, ordre)
select 'Retenu', 'coral', false, 1
where not exists (select 1 from public.candidature_onglets where nom = 'Retenu');

insert into public.candidature_onglets (nom, couleur, fixe, ordre)
select 'Peut-être', 'yellow', false, 2
where not exists (select 1 from public.candidature_onglets where nom = 'Peut-être');

insert into public.candidature_onglets (nom, couleur, fixe, ordre)
select 'Ok dispo', 'turquoise', false, 3
where not exists (select 1 from public.candidature_onglets where nom = 'Ok dispo');

insert into public.candidature_onglets (nom, couleur, fixe, ordre)
select 'OUT BE', 'danger', true, 99
where not exists (select 1 from public.candidature_onglets where nom = 'OUT BE');

alter table public.candidatures
  add column if not exists onglet_id uuid references public.candidature_onglets (id) on delete set null;

create index if not exists candidatures_onglet_id_idx on public.candidatures (onglet_id);

-- Migration des anciens statuts vers les nouveaux onglets, une seule fois.
update public.candidatures c
set onglet_id = (select id from public.candidature_onglets where nom = 'Retenu')
where c.statut = 'retenu' and c.onglet_id is null;

update public.candidatures c
set onglet_id = (select id from public.candidature_onglets where nom = 'OUT BE')
where c.statut = 'refuse' and c.onglet_id is null;

alter table public.candidature_onglets enable row level security;
drop policy if exists "authenticated full access" on public.candidature_onglets;
create policy "authenticated full access" on public.candidature_onglets
  for all to authenticated using (true) with check (true);
grant all on public.candidature_onglets to service_role, authenticated;

-- Un figurant n'apparaît dans Base Profils qu'une fois "confirmé" : ajouté
-- à la main par le staff (toujours vrai immédiatement), ou transféré dans
-- une journée (booking créé). Les candidatures pas encore transférées
-- restent temporaires — visibles uniquement dans Candidatures.
alter table public.figurants add column if not exists confirme boolean not null default false;

-- Rétro-compatibilité : un figurant déjà booké, ou créé sans jamais avoir
-- postulé (donc ajouté à la main), est considéré confirmé dès maintenant.
update public.figurants f
set confirme = true
where confirme = false
  and (
    exists (select 1 from public.bookings b where b.figurant_id = f.id)
    or not exists (select 1 from public.candidatures c where c.figurant_id = f.id)
  );
