-- Base comédien·nes personnelle par chef·fe, avec un groupe partagé pour
-- les 4 comptes fondateurs (Loïc, Mathieu, Marie, Jodie) — eux continuent
-- de voir toutes les fiches comédien·nes comme aujourd'hui ; toute autre
-- chef·fe ajoutée plus tard aura sa propre base comédien·nes, séparée. Les
-- fiches figurant·es (non comédien·nes) restent partagées par tout le
-- monde, comme avant — seule la visibilité des comédien·nes change.
--
-- is_owner devient une colonne plutôt qu'un email en dur (voir
-- src/lib/auth/owner.ts, qui l'anticipait déjà) — Mathieu rejoint Loïc
-- comme "compte propriétaire" (accès à tout, toutes les chef·fes).

alter table public.profiles add column if not exists is_owner boolean not null default false;
alter table public.profiles add column if not exists comedien_pool_id uuid references public.profiles(id);
alter table public.figurants add column if not exists comedien_pool_id uuid references public.profiles(id);

update public.profiles set is_owner = true where email = 'loicmaldonado@gmail.com';
update public.profiles set comedien_pool_id = id where email = 'loicmaldonado@gmail.com';

update public.profiles
set comedien_pool_id = (select id from public.profiles where email = 'loicmaldonado@gmail.com'),
    is_owner = true
where email = 'mathieumanson99@gmail.com';

update public.profiles
set comedien_pool_id = (select id from public.profiles where email = 'loicmaldonado@gmail.com')
where email = 'marie.krjn@gmail.com';

-- Les comédien·nes déjà en base (toutes créées par Loïc jusqu'ici)
-- rejoignent le pool partagé — rien ne change pour le groupe fondateur.
update public.figurants
set comedien_pool_id = (select id from public.profiles where email = 'loicmaldonado@gmail.com')
where est_comedien = true and comedien_pool_id is null;

create or replace function public.is_owner()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_owner = true
  );
$$ language sql stable security definer set search_path = public;

-- figurants : plus de policy "authenticated full access" pour la lecture —
-- une chef·fe hors du pool ne voit plus les comédien·nes gérées ailleurs.
-- comedien_pool_id is null reste visible (filet de sécurité si jamais une
-- fiche comédien·ne se retrouve sans pool par erreur, plutôt que la
-- masquer silencieusement à tout le monde). Écriture laissée ouverte comme
-- avant — seule la visibilité était demandée, pas une restriction d'accès
-- en modification.
drop policy if exists "authenticated full access" on public.figurants;

create policy "figurants read scope" on public.figurants for select to authenticated
  using (
    not est_comedien
    or public.is_owner()
    or comedien_pool_id is null
    or comedien_pool_id = coalesce(
      (select p.comedien_pool_id from public.profiles p where p.id = auth.uid()),
      auth.uid()
    )
  );

create policy "figurants write" on public.figurants for insert to authenticated with check (true);
create policy "figurants update" on public.figurants for update to authenticated using (true) with check (true);
create policy "figurants delete" on public.figurants for delete to authenticated using (true);
