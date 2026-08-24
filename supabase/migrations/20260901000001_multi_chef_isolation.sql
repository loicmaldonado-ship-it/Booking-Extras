-- Multi chef·fes réel : chaque chef·fe ne voit plus que ses propres projets
-- (+ ceux partagés via projet_membres), au lieu d'un accès total pour
-- n'importe quel profil role='chef'. Le compte propriétaire (email
-- loicmaldonado@gmail.com, voir src/lib/auth/owner.ts) garde un accès total
-- à tout — c'est la "session Admin" qui permet d'aller aider n'importe
-- quelle autre chef·fe sans mécanisme d'impersonation à part : il/elle a
-- juste toujours accès à tous les projets, comme aujourd'hui.
--
-- Les projets existants (créés avant cette migration, tous à Loïc) sont
-- rattachés à son profil pour ne pas se retrouver orphelins.
update public.projets
set owner_id = (select id from public.profiles where email = 'loicmaldonado@gmail.com')
where owner_id is null;

create or replace function public.is_owner()
returns boolean as $$
  select exists (
    select 1 from auth.users where id = auth.uid() and email = 'loicmaldonado@gmail.com'
  );
$$ language sql stable security definer set search_path = public;

grant execute on function public.is_owner() to authenticated;

-- has_projet_access sert de base à quasi toutes les policies scopées par
-- projet_id (journees, annonces, bookings, essayages, candidatures) : la
-- redéfinir suffit à propager l'isolation partout sans toucher chaque
-- policy individuellement.
create or replace function public.has_projet_access(pid uuid)
returns boolean as $$
  select public.is_owner()
    or exists (select 1 from public.projets where id = pid and owner_id = auth.uid())
    or exists (
      select 1 from public.projet_membres
      where projet_id = pid and profile_id = auth.uid()
    );
$$ language sql stable security definer set search_path = public;

-- projets : une chef·fe ne gère (update/delete) que ses propres projets ;
-- la création vérifie que owner_id pointe bien vers soi-même (empêche de
-- créer un projet au nom d'un·e autre chef·fe).
drop policy if exists "chef writes" on public.projets;
create policy "chef writes" on public.projets for insert to authenticated
  with check (public.is_owner() or (public.is_chef() and owner_id = auth.uid()));

drop policy if exists "chef updates" on public.projets;
create policy "owner updates" on public.projets for update to authenticated
  using (public.is_owner() or owner_id = auth.uid())
  with check (public.is_owner() or owner_id = auth.uid());

drop policy if exists "chef deletes" on public.projets;
create policy "owner deletes" on public.projets for delete to authenticated
  using (public.is_owner() or owner_id = auth.uid());

-- projet_membres : seul·e le/la propriétaire du projet (ou le compte
-- propriétaire de l'agence) invite/révoque des accès dessus — plus
-- n'importe quelle chef·fe sur n'importe quel projet.
drop policy if exists "chef invites" on public.projet_membres;
create policy "projet owner invites" on public.projet_membres for insert to authenticated
  with check (
    public.is_owner()
    or exists (select 1 from public.projets where id = projet_id and owner_id = auth.uid())
  );

drop policy if exists "chef revokes" on public.projet_membres;
create policy "projet owner revokes" on public.projet_membres for delete to authenticated
  using (
    public.is_owner()
    or exists (select 1 from public.projets where id = projet_id and owner_id = auth.uid())
  );

-- profiles : modifier/supprimer un profil (changer son rôle, le retirer)
-- devient réservé au compte propriétaire — plus à n'importe quelle chef·fe,
-- qui pourrait sinon se donner accès à tout en se passant role='chef' à
-- elle-même ou révoquer une autre chef·fe.
drop policy if exists "update self or chef" on public.profiles;
create policy "update self or owner" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

drop policy if exists "chef deletes" on public.profiles;
create policy "owner deletes" on public.profiles for delete to authenticated
  using (public.is_owner());
