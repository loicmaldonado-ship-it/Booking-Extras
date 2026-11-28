-- Execute only inside an isolated test database and a transaction containing the migration.
do $$
declare active_id uuid := gen_random_uuid(); snapshot jsonb; inactive_count integer;
begin
  if has_function_privilege('anon','public.rgpd_lister_profils_inactifs_snapshot(date)','execute')
    or has_function_privilege('authenticated','public.rgpd_lister_profils_inactifs_snapshot(date)','execute')
    or not has_function_privilege('service_role','public.rgpd_lister_profils_inactifs_snapshot(date)','execute') then
    raise exception 'Unexpected snapshot function privileges';
  end if;
  insert into public.figurants(id, prenom, nom, updated_at, date_naissance)
  values (active_id, 'Test', 'RECETTE_SNAPSHOT_ACTIF', '2020-01-01T00:00:00Z', date '1980-01-01');
  insert into public.figurants(prenom, nom, anonymisation_en_cours_at)
  values ('Test', 'RECETTE_SNAPSHOT_EN_COURS', now());
  insert into public.figurants(prenom, nom, updated_at, date_naissance)
  select 'Test', 'RECETTE_SNAPSHOT_INACTIF_' || n, '2020-01-01T00:00:00Z', date '1980-01-01' from generate_series(1,1001) n;
  insert into public.bookings(figurant_id, projet_id, date)
  select active_id, '00000000-0000-4000-8000-0000000070e0'::uuid, date '2010-01-01' + n
  from generate_series(1,1000) n;
  insert into public.bookings(figurant_id, projet_id, date)
  values (active_id, '00000000-0000-4000-8000-0000000070e0'::uuid, date '2031-10-01');
  insert into public.figurant_comptes(figurant_id, password_hash)
  select id, 'fixture-only-hash' from public.figurants where nom like 'RECETTE_SNAPSHOT_INACTIF_%';
  insert into public.candidatures(figurant_id, annonce_id, created_at)
  select id, '00000000-0000-4000-8000-00000000a101'::uuid,
    case when nom = 'RECETTE_SNAPSHOT_INACTIF_1' then '2031-10-01T00:00:00Z'::timestamptz else '2020-01-01T00:00:00Z'::timestamptz end
  from public.figurants where nom like 'RECETTE_SNAPSHOT_INACTIF_%';
  snapshot := public.rgpd_lister_profils_inactifs_snapshot(date '2030-10-29');
  select count(*) into inactive_count from jsonb_array_elements(snapshot) item
    where item->>'nom' like 'RECETTE_SNAPSHOT_INACTIF_%';
  if inactive_count <> 1000 then raise exception 'Incomplete snapshot: %', inactive_count; end if;
  if not exists(select 1 from jsonb_array_elements(snapshot) item where item->>'nom' = 'RECETTE_SNAPSHOT_EN_COURS' and item->>'effacementEnCours' = 'true') then
    raise exception 'Pending erasure was not included';
  end if;
  if exists(select 1 from jsonb_array_elements(snapshot) item where item->>'id' = active_id::text) then
    raise exception 'Recently booked profile was listed as inactive';
  end if;
end $$;
rollback;
