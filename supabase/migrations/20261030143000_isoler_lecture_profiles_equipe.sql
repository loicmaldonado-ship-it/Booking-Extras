-- DEC-02 / SEC-03 (décision validée par Maxime le 30/10/2026) : le personnel d'une équipe ne doit plus
-- voir les nom, email et téléphone du personnel des autres équipes. La policy « read all » (using true)
-- est remplacée par : son propre profil, les personnes partageant au moins un projet (propriétaire ou
-- membre), ou tout pour la propriétaire globale. Lecture applicative inchangée : hors son propre profil
-- (getCurrentProfile), toutes les lectures de profiles passent par service_role.
begin;

create or replace function public.shares_project_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid()
    or public.is_owner()
    or exists (
      select 1
      from public.projets p
      where (p.owner_id = auth.uid()
             or exists (select 1 from public.projet_membres m where m.projet_id = p.id and m.profile_id = auth.uid()))
        and (p.owner_id = target
             or exists (select 1 from public.projet_membres m where m.projet_id = p.id and m.profile_id = target))
    );
$$;

revoke all on function public.shares_project_with(uuid) from public, anon;
grant execute on function public.shares_project_with(uuid) to authenticated, service_role;

drop policy if exists "read all" on public.profiles;
drop policy if exists "read self or same team" on public.profiles;
create policy "read self or same team" on public.profiles
  for select to authenticated
  using (public.shares_project_with(id));

commit;
