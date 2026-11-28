-- BUG-06: refuse cascading deletion on any existing FK reference.
-- The owner must explicitly confirm in the UI, and the database holds a
-- row lock while checking dependents, preventing concurrent FK insert races.
create or replace function public.delete_unused_figurant(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  relation record;
  linked boolean;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Accès non autorisé.' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Identifiant obligatoire.' using errcode = '22023';
  end if;
  perform id from public.figurants where id = p_id for update;
  if not found then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;

  -- Covers ALL current and future single-column FKs to the candidate,
  -- including candidatures, bookings, messages, photos, auth and project data.
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
    order by r.relname
  loop
    execute format('select exists(select 1 from %I.%I where %I = $1)',
       relation.schema_name, relation.table_name, relation.column_name)
       into linked using p_id;
    if linked then
      raise exception 'Profil lié à des données métier : %', relation.table_name
         using errcode = '23503';
    end if;
  end loop;

  delete from public.figurants where id = p_id;
end;
$$;

revoke all on function public.delete_unused_figurant(uuid) from public;
revoke all on function public.delete_unused_figurant(uuid) from anon;
grant execute on function public.delete_unused_figurant(uuid) to authenticated;
