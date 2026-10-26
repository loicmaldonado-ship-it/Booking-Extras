-- BUG-12 : ordre des dépendances et conservation des protections apparues ensuite.
create or replace function public.merge_figurants_atomique(
  p_keep_id uuid,
  p_merge_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation record;
  merged_profile record;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Fusion réservée au compte propriétaire.' using errcode = '42501';
  end if;
  if p_keep_id is null or p_merge_id is null or p_keep_id = p_merge_id then
    raise exception 'Deux profils distincts sont obligatoires.' using errcode = '22023';
  end if;

  -- Stable lock order prevents deadlocks when two requests use reversed IDs.
  perform id from public.figurants
  where id in (p_keep_id, p_merge_id)
  order by id for update;
  if (select count(*) from public.figurants where id in (p_keep_id, p_merge_id)) <> 2 then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;

  select confirme, acces_compte into merged_profile
  from public.figurants where id = p_merge_id;

  if exists(select 1 from public.figurants where id in (p_keep_id,p_merge_id) and (anonymise or anonymisation_en_cours_at is not null)) then
    raise exception 'Fusion impossible pendant ou après effacement.' using errcode='23514';
  end if;
  if exists(select 1 from public.minor_dossiers where figurant_id in (p_keep_id,p_merge_id))
     or exists(select 1 from public.minor_guardians where figurant_id in (p_keep_id,p_merge_id)) then
    raise exception 'Fusion avec données légales mineur non automatique : conserver les deux fiches et faire vérifier leur identité et leurs pièces.' using errcode='23514';
  end if;

  -- Le compte précède ses candidatures. Deux comptes produisent une erreur
  -- d’unicité, sans écrasement du mot de passe ni changement partiel.
  update public.figurant_comptes set figurant_id=p_keep_id where figurant_id=p_merge_id;
  update public.figurants
  set confirme=coalesce(confirme,false) or coalesce(merged_profile.confirme,false),
      acces_compte=coalesce(acces_compte,false) or coalesce(merged_profile.acces_compte,false)
  where id=p_keep_id;
  -- Une session ancienne ne doit pas changer d’identité lors d’une fusion.
  delete from public.figurant_sessions where figurant_id in(p_keep_id,p_merge_id);
  delete from public.figurant_auth_tokens where figurant_id in(p_keep_id,p_merge_id);

  -- Réattacher les autres FK ; toute erreur annule également les étapes ci-dessus.
  for relation in
    select n.nspname as schema_name, r.relname as table_name, a.attname as column_name
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class r on r.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = r.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = r.oid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.figurants'::regclass
      and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
      and array_length(c.confkey, 1) = 1
    order by n.nspname, r.relname, a.attname
  loop
    execute format('update %I.%I set %I = $1 where %I = $2',
      relation.schema_name, relation.table_name, relation.column_name,
      relation.column_name)
      using p_keep_id, p_merge_id;
  end loop;

  delete from public.figurants where id = p_merge_id;
end;
$$;

revoke all on function public.merge_figurants_atomique(uuid, uuid) from public;
revoke all on function public.merge_figurants_atomique(uuid, uuid) from anon;
grant execute on function public.merge_figurants_atomique(uuid, uuid) to authenticated;
