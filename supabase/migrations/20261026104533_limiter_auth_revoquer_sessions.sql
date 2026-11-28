-- Compteurs distribués : compte (6/15 min), réseau (60/15 min), paire (6/15 min).
create or replace function public.consume_candidate_auth_limits(p_account_hash text,p_ip_hash text,p_pair_hash text)
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare k record; n integer; allowed boolean:=true;
begin
 if p_account_hash is null or p_ip_hash is null or p_pair_hash is null
   or p_account_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_pair_hash !~ '^[0-9a-f]{64}$'
   or p_account_hash=p_ip_hash or p_account_hash=p_pair_hash or p_ip_hash=p_pair_hash then return false; end if;
 -- Ordre commun des verrous : évite les interblocages entre requêtes concurrentes.
 for k in select * from (values(p_account_hash,6),(p_ip_hash,60),(p_pair_hash,6)) as keys(hash,lim) order by hash loop
  insert into public.candidate_auth_attempts as a(key_hash,period_started_at,attempts) values(k.hash,now(),1)
  on conflict(key_hash) do update set
   attempts=case when a.period_started_at<=now()-interval '15 minutes' then 1 else least(a.attempts+1,1000000) end,
   period_started_at=case when a.period_started_at<=now()-interval '15 minutes' then now() else a.period_started_at end
  returning attempts into n;
  allowed:=allowed and n<=k.lim;
 end loop;
 delete from public.candidate_auth_attempts where period_started_at<now()-interval '24 hours';
 return allowed;
end $fn$;
revoke all on function public.consume_candidate_auth_limits(text,text,text) from public,anon,authenticated;
grant execute on function public.consume_candidate_auth_limits(text,text,text) to service_role;

drop function if exists public.changer_mot_de_passe_candidat(uuid,text);
drop function if exists public.changer_mot_de_passe_candidat(uuid,text,boolean);
create or replace function public.changer_mot_de_passe_candidat(p_id uuid,p_hash text,p_creer_session boolean default false,p_current_token text default null)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare new_token text; expiry timestamptz;
begin
 if p_id is null or p_hash is null or p_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$' then raise exception 'Valeur invalide'; end if;
 perform 1 from public.figurants where id=p_id for update;
 if not found then raise exception 'Compte introuvable'; end if;
 if p_creer_session and not exists(select 1 from public.figurant_sessions where figurant_id=p_id and token=p_current_token and expires_at>now()) then
  raise exception 'Session expirée';
 end if;
 insert into public.figurant_comptes(figurant_id,password_hash,updated_at) values(p_id,p_hash,now())
 on conflict(figurant_id) do update set password_hash=excluded.password_hash,updated_at=excluded.updated_at;
 delete from public.figurant_sessions where figurant_id=p_id;
 delete from public.figurant_auth_tokens where figurant_id=p_id;
 if p_creer_session then
  new_token:=encode(extensions.gen_random_bytes(16),'hex'); expiry:=now()+interval '7 days';
  insert into public.figurant_sessions(figurant_id,token,expires_at) values(p_id,new_token,expiry);
  return jsonb_build_object('token',new_token,'expires_at',expiry);
 end if;
 return '{}'::jsonb;
end $fn$;
revoke all on function public.changer_mot_de_passe_candidat(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.changer_mot_de_passe_candidat(uuid,text,boolean,text) to service_role;

-- L'âge de session vient du serveur d'authentification, jamais d'un cookie modifiable.
-- SECURITY DEFINER nécessaire pour lire auth.sessions ; seuls le sujet et la session
-- du JWT signé de l'appelant sont recherchés, aucune entrée paramétrable.
create or replace function public.staff_session_is_current()
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(
  select 1 from auth.sessions s where s.user_id=auth.uid()
   and s.id::text=(auth.jwt()->>'session_id')
   and s.created_at>now()-interval '1 hour'
   and (s.not_after is null or s.not_after>now())
 );
$fn$;
revoke all on function public.staff_session_is_current() from public,anon;
grant execute on function public.staff_session_is_current() to authenticated;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path='' as $fn$
 select public.staff_session_is_current() and exists(select 1 from public.profiles where id=auth.uid() and is_owner=true);
$fn$;
create or replace function public.is_chef()
returns boolean language sql stable security definer set search_path='' as $fn$
 select public.staff_session_is_current() and exists(select 1 from public.profiles where id=auth.uid() and role='chef');
$fn$;
create or replace function public.has_projet_access(pid uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select public.staff_session_is_current() and (
  public.is_owner()
  or exists(select 1 from public.projets where id=pid and owner_id=auth.uid())
  or exists(select 1 from public.projet_membres where projet_id=pid and profile_id=auth.uid())
 );
$fn$;
revoke all on function public.is_owner(),public.is_chef(),public.has_projet_access(uuid) from public,anon;
grant execute on function public.is_owner(),public.is_chef(),public.has_projet_access(uuid) to authenticated;

drop policy if exists "active staff session" on public.annonce_dates;
create policy "active staff session" on public.annonce_dates as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.annonce_photos;
create policy "active staff session" on public.annonce_photos as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.annonce_questions;
create policy "active staff session" on public.annonce_questions as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.annonces;
create policy "active staff session" on public.annonces as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.bookings;
create policy "active staff session" on public.bookings as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidature_disponibilites;
create policy "active staff session" on public.candidature_disponibilites as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidature_etiquette_liens;
create policy "active staff session" on public.candidature_etiquette_liens as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidature_etiquettes;
create policy "active staff session" on public.candidature_etiquettes as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidature_jours;
create policy "active staff session" on public.candidature_jours as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidature_reponses;
create policy "active staff session" on public.candidature_reponses as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.candidatures;
create policy "active staff session" on public.candidatures as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_entries;
create policy "active staff session" on public.casting_entries as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_presentiel_creneaux;
create policy "active staff session" on public.casting_presentiel_creneaux as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_presentiel_entries;
create policy "active staff session" on public.casting_presentiel_entries as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_presentiel_journees;
create policy "active staff session" on public.casting_presentiel_journees as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_roles;
create policy "active staff session" on public.casting_roles as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.casting_upload_events;
create policy "active staff session" on public.casting_upload_events as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.essayage_journees;
create policy "active staff session" on public.essayage_journees as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.essayages;
create policy "active staff session" on public.essayages as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.figurant_liens;
create policy "active staff session" on public.figurant_liens as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.figurant_photos;
create policy "active staff session" on public.figurant_photos as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.figurants;
create policy "active staff session" on public.figurants as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.journee_besoins;
create policy "active staff session" on public.journee_besoins as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.journees;
create policy "active staff session" on public.journees as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.partage_journee_liens;
create policy "active staff session" on public.partage_journee_liens as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.partage_liens;
create policy "active staff session" on public.partage_liens as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.profiles;
create policy "active staff session" on public.profiles as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.projet_membres;
create policy "active staff session" on public.projet_membres as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.projets;
create policy "active staff session" on public.projets as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

drop policy if exists "active staff session" on public.reserve_profils;
create policy "active staff session" on public.reserve_profils as restrictive for all to authenticated
 using ((select public.staff_session_is_current())) with check ((select public.staff_session_is_current()));

notify pgrst, 'reload schema';
