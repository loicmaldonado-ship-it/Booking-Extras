-- Auth & Rôles : connexion réelle, deux rôles (chef / assistant), accès aux
-- projets scopé par invitation (projet_membres), révocation facile côté chef.

update public.profiles set role = 'chef' where role = 'collaborateur';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role set default 'assistant';
alter table public.profiles add constraint profiles_role_check
  check (role in ('assistant', 'chef'));

-- Premier compte créé = chef (bootstrap), tous les suivants = assistant par
-- défaut (le chef les invite ensuite sur des projets précis).
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when (select count(*) from public.profiles) = 0 then 'chef' else 'assistant' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Helpers RLS
create or replace function public.is_chef()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'chef'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.has_projet_access(pid uuid)
returns boolean as $$
  select public.is_chef() or exists (
    select 1 from public.projet_membres
    where projet_id = pid and profile_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- profiles : tout le monde authentifié peut lire (besoin des noms dans
-- l'UI) ; seul le chef (ou soi-même pour son propre profil) peut modifier ;
-- seul le chef peut supprimer.
drop policy if exists "authenticated full access" on public.profiles;
create policy "read all" on public.profiles for select to authenticated using (true);
create policy "update self or chef" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_chef())
  with check (id = auth.uid() or public.is_chef());
create policy "chef deletes" on public.profiles for delete to authenticated
  using (public.is_chef());

-- projets : chef voit/gère tout ; assistant voit ceux où il a un accès.
drop policy if exists "authenticated full access" on public.projets;
create policy "select scoped" on public.projets for select to authenticated
  using (public.has_projet_access(id));
create policy "chef writes" on public.projets for insert to authenticated
  with check (public.is_chef());
create policy "chef updates" on public.projets for update to authenticated
  using (public.is_chef()) with check (public.is_chef());
create policy "chef deletes" on public.projets for delete to authenticated
  using (public.is_chef());

-- projet_membres : seul le chef gère les invitations/révocations ;
-- l'assistant peut voir ses propres accès.
drop policy if exists "authenticated full access" on public.projet_membres;
create policy "select own or chef" on public.projet_membres for select to authenticated
  using (public.is_chef() or profile_id = auth.uid());
create policy "chef invites" on public.projet_membres for insert to authenticated
  with check (public.is_chef());
create policy "chef revokes" on public.projet_membres for delete to authenticated
  using (public.is_chef());

-- journees, annonces, bookings, essayages : scopées par projet_id direct.
drop policy if exists "authenticated full access" on public.journees;
create policy "scoped by projet" on public.journees for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

drop policy if exists "authenticated full access" on public.annonces;
create policy "scoped by projet" on public.annonces for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

drop policy if exists "authenticated full access" on public.bookings;
create policy "scoped by projet" on public.bookings for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

drop policy if exists "authenticated full access" on public.essayages;
create policy "scoped by projet" on public.essayages for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));

-- candidatures : scopées via l'annonce à laquelle elles se rattachent.
drop policy if exists "authenticated full access" on public.candidatures;
create policy "scoped by projet" on public.candidatures for all to authenticated
  using (
    exists (
      select 1 from public.annonces
      where annonces.id = candidatures.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.annonces
      where annonces.id = candidatures.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

grant execute on function public.is_chef() to authenticated;
grant execute on function public.has_projet_access(uuid) to authenticated;
