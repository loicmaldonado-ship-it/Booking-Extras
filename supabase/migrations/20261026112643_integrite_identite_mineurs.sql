-- Les champs d'identité et les représentants sont enregistrés ensemble.
create or replace function public.update_candidate_identity(p_id uuid,p_email text,p_birth date,p_guardians jsonb default null)
returns void language plpgsql security invoker set search_path='' as $fn$
declare today date:=(now() at time zone 'Europe/Paris')::date;
begin
 if p_birth is null or p_birth>today or p_birth<today-interval '121 years' then raise exception 'Date de naissance invalide'; end if;
 if p_email is null or length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email invalide'; end if;
 perform 1 from public.figurants where id=p_id for update;
 if not found then raise exception 'Profil introuvable'; end if;
 update public.figurants set email=lower(btrim(p_email)),date_naissance=p_birth where id=p_id;
 if p_birth>today-interval '18 years' then
  perform public.save_minor_guardians(p_id,p_guardians);
 end if;
end;
$fn$;
revoke all on function public.update_candidate_identity(uuid,text,date,jsonb) from public,anon,authenticated;
grant execute on function public.update_candidate_identity(uuid,text,date,jsonb) to service_role;

-- Différé à la fin de la transaction : l'identité peut être modifiée avant les
-- représentants dans le même RPC, jamais laissée dans un état incomplet.
create or replace function public.check_minor_identity_update()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare f public.figurants; today date:=(now() at time zone 'Europe/Paris')::date;
begin
 select * into f from public.figurants where id=new.id;
 if exists(select 1 from public.figurant_comptes where figurant_id=f.id) then
  if f.date_naissance is null or f.date_naissance>today then raise exception 'Date de naissance requise'; end if;
  if f.date_naissance>today-interval '18 years' and not public.minor_guardians_complete(f.id) then raise exception 'Représentants légaux incomplets'; end if;
 end if;
 return null;
end;
$fn$;
revoke all on function public.check_minor_identity_update() from public,anon,authenticated;
create constraint trigger minor_identity_update after update of email,date_naissance on public.figurants
deferrable initially deferred for each row execute function public.check_minor_identity_update();
notify pgrst,'reload schema';
