-- Base Profils : la lecture complète des fiches reliées à un compte candidat est réservée au personnel qui a
-- la section « Base Profils » (chef·fes, propriétaire, assistant·es sans restriction ou avec la section cochée).
-- Une assistante restreinte garde :
--   * les fiches complètes des personnes liées à ses projets (bookings, casting, essayages, candidatures, profils temporaires) ;
--   * les noms seuls des autres personnes de la base, pour les listes de choix (figurants_choix) ;
--   * le droit de les rattacher à ses projets (trigger enforce_staff_person_reference).
-- Audit du 31/10/2026 : avant, n'importe quelle session du personnel lisait toutes ces fiches par l'API.

create or replace function public.voit_base_profils()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select public.staff_session_is_current() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.is_owner or p.role = 'chef' or p.sections_autorisees is null or '/figurants' = any (p.sections_autorisees))
  );
$fn$;
revoke all on function public.voit_base_profils() from public, anon;
grant execute on function public.voit_base_profils() to authenticated, service_role;

-- Une personne de la base partagée que tout membre du personnel peut choisir (sans lire sa fiche).
create or replace function public.figurant_choisissable(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select public.staff_session_is_current()
    and exists (select 1 from public.profiles p where p.id = auth.uid())
    and exists (select 1 from public.figurants f where f.id = fid and f.acces_compte and not f.est_comedien);
$fn$;
revoke all on function public.figurant_choisissable(uuid) from public, anon;
grant execute on function public.figurant_choisissable(uuid) to authenticated, service_role;

-- Noms seuls pour les listes de choix ; la date de naissance n'est rendue que pour les mineur·es (page Mineurs / DRIEETS).
create or replace function public.figurants_choix(p_ids uuid[] default null)
returns table (id uuid, prenom text, nom text, date_naissance date)
language sql stable security definer set search_path = '' as $fn$
  select f.id, f.prenom, f.nom,
         case when f.date_naissance > current_date - interval '18 years' then f.date_naissance end
  from public.figurants f
  where public.staff_session_is_current()
    and exists (select 1 from public.profiles p where p.id = auth.uid())
    and f.acces_compte and not f.est_comedien
    and (p_ids is null or f.id = any (p_ids))
  order by f.nom, f.prenom;
$fn$;
revoke all on function public.figurants_choix(uuid[]) from public, anon;
grant execute on function public.figurants_choix(uuid[]) to authenticated, service_role;

drop policy if exists "figurants read scope" on public.figurants;
create policy "figurants read scope" on public.figurants for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid())
  and (
    public.is_owner()
    or (est_comedien and comedien_pool_id = coalesce(
        (select p.comedien_pool_id from public.profiles p where p.id = auth.uid()), auth.uid()))
    or (not est_comedien and (
        (acces_compte and public.voit_base_profils())
        or (temporaire_projet_id is not null and public.has_projet_access(temporaire_projet_id))
        or exists (select 1 from public.bookings b where b.figurant_id = figurants.id and public.has_projet_access(b.projet_id))
        or exists (select 1 from public.casting_entries c where c.figurant_id = figurants.id and public.has_projet_access(c.projet_id))
        or exists (select 1 from public.essayages e where e.figurant_id = figurants.id and public.has_projet_access(e.projet_id))
        or exists (select 1 from public.candidatures ca join public.annonces a on a.id = ca.annonce_id
                   where ca.figurant_id = figurants.id and public.has_projet_access(a.projet_id))
      )
    )
  )
);

-- Rattacher une personne : visible par la session, ou personne de la base partagée (choisissable sans lecture de fiche).
create or replace function public.enforce_staff_person_reference()
returns trigger language plpgsql set search_path = '' as $$
declare subject uuid; driver uuid;
begin
 if current_setting('role',true) is distinct from 'authenticated' then return new; end if;
 subject := (to_jsonb(new)->>'figurant_id')::uuid;
 driver := (to_jsonb(new)->>'covoiturage_conducteur_id')::uuid;
 if subject is not null and not exists(select 1 from public.figurants where id=subject)
    and not public.figurant_choisissable(subject) then
  raise exception 'Profil introuvable ou inaccessible' using errcode='42501';
 end if;
 if driver is not null and not exists(select 1 from public.figurants where id=driver)
    and not public.figurant_choisissable(driver) then
  raise exception 'Profil conducteur introuvable ou inaccessible' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function public.enforce_staff_person_reference() from public, anon, authenticated;
