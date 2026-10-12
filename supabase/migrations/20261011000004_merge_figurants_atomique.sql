-- BUG-12: merge all direct FK references in one database transaction.
-- IMPORTANT: failure on any unique/foreign-key constraint aborts the whole
-- statement, preserving both original profiles and every associated record.
-- This deliberately does not silently discard duplicate candidatures.

create or replace function public.merge_figurants_atomique(
  p_keep_id uuid,
  p_merge_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
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

  -- Every single-column FK to figurants.id is reattached, including
  -- candidate sessions, access tokens, media rows and driver references.
  -- If ANY table constraint fails, PostgreSQL rolls all updates back.
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

  update public.figurants
  set confirme = coalesce(confirme, false) or coalesce(merged_profile.confirme, false),
      acces_compte = coalesce(acces_compte, false) or coalesce(merged_profile.acces_compte, false)
  where id = p_keep_id;

  delete from public.figurants where id = p_merge_id;
end;
$$;

revoke all on function public.merge_figurants_atomique(uuid, uuid) from public;
revoke all on function public.merge_figurants_atomique(uuid, uuid) from anon;
grant execute on function public.merge_figurants_atomique(uuid, uuid) to authenticated;
