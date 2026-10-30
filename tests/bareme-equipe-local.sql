-- Barème par équipe (30/10/2026) : copie de la référence, isolation entre équipes, rattachement des majorations.
-- Base LOCALE uniquement, tout est annulé (rollback).
-- docker exec -i supabase_db_BOOKING_EXTRAS psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/bareme-equipe-local.sql
begin;
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  fig uuid := gen_random_uuid(); bka uuid := gen_random_uuid(); bkb uuid := gen_random_uuid();
  ref_maj uuid; ref_cachet uuid; ref_count_c int; ref_count_m int; ref_hash text; copie uuid; n int; first boolean;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  select count(*), md5(string_agg(to_jsonb(r)::text,'|' order by id)) into ref_count_c, ref_hash from public.bareme_cachets r where equipe_id is null;
  select count(*) into ref_count_m from public.bareme_majorations where equipe_id is null;
  assert ref_count_c > 0 and ref_count_m > 0, 'Référence ACFDA absente';
  select id into ref_maj from public.bareme_majorations where equipe_id is null order by id limit 1;
  select id into ref_cachet from public.bareme_cachets where equipe_id is null order by id limit 1;

  insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data) values
    (a,'bareme-a-'||a||'@example.test','authenticated','authenticated','{}','{}'),(b,'bareme-b-'||b||'@example.test','authenticated','authenticated','{}','{}');
  update public.profiles set role='chef', is_owner=false where id in (a,b);
  insert into public.projets(id,nom,owner_id) values (pa,'Barème A fictif',a),(pb,'Barème B fictif',b);
  insert into public.figurants(id,prenom,nom,date_naissance,acces_compte) values (fig,'Bareme','Fictif','1990-01-01',false);
  insert into public.bookings(id,figurant_id,projet_id,date) values (bka,fig,pa,current_date+90),(bkb,fig,pb,current_date+90);
  insert into public.booking_majorations(booking_id,bareme_majoration_id) values (bka,ref_maj),(bkb,ref_maj);

  assert public.equipe_cle_projet(pa) = a and public.equipe_cle_projet(pb) = b, 'Clé d''équipe du projet incorrecte';

  -- Première copie pour A
  first := public.copier_bareme_equipe(a);
  assert first, 'Première copie non effectuée';
  select count(*) into n from public.bareme_cachets where equipe_id = a; assert n = ref_count_c, 'Copie des cachets incomplète';
  select count(*) into n from public.bareme_majorations where equipe_id = a; assert n = ref_count_m, 'Copie des majorations incomplète';
  select id into copie from public.bareme_majorations where equipe_id = a and source_id = ref_maj;
  assert exists(select 1 from public.booking_majorations where booking_id = bka and bareme_majoration_id = copie), 'Majoration du booking A non rattachée à la copie A';
  assert exists(select 1 from public.booking_majorations where booking_id = bkb and bareme_majoration_id = ref_maj), 'Majoration du booking B déplacée par la copie de A';

  -- Idempotence : une ligne supprimée par l'équipe n'est jamais recopiée
  delete from public.bareme_cachets where equipe_id = a and source_id = ref_cachet;
  first := public.copier_bareme_equipe(a);
  assert not first, 'Deuxième copie effectuée';
  select count(*) into n from public.bareme_cachets where equipe_id = a; assert n = ref_count_c - 1, 'Ligne supprimée recopiée';

  -- Modification de A : n'affecte ni la référence ni B
  update public.bareme_cachets set montant_brut = 999 where equipe_id = a;
  assert (select md5(string_agg(to_jsonb(r)::text,'|' order by id)) from public.bareme_cachets r where equipe_id is null) = ref_hash, 'Référence modifiée';
  perform public.copier_bareme_equipe(b);
  assert not exists(select 1 from public.bareme_cachets where equipe_id = b and montant_brut = 999), 'Modification de A visible dans B';
  assert exists(select 1 from public.booking_majorations bm join public.bareme_majorations m on m.id = bm.bareme_majoration_id where bm.booking_id = bkb and m.equipe_id = b), 'Majoration du booking B non rattachée à la copie B';

  -- Unicité par équipe : A et B peuvent avoir chacun le même cachet / date ; doublon interdit dans une même équipe
  begin
    insert into public.bareme_cachets(convention,cachet,montant_brut,date_effet,equipe_id)
      select convention,cachet,1,date_effet,b from public.bareme_cachets where equipe_id = b limit 1;
    raise exception using errcode='ZX001', message='Doublon dans une même équipe accepté';
  exception when unique_violation then null; end;

  -- Droits : réservé à service_role
  assert not has_function_privilege('authenticated','public.copier_bareme_equipe(uuid)','execute'), 'copier_bareme_equipe exécutable par authenticated';
  assert not has_function_privilege('anon','public.copier_bareme_equipe(uuid)','execute'), 'copier_bareme_equipe exécutable par anon';
  assert not has_table_privilege('authenticated','public.bareme_equipes','select'), 'bareme_equipes lisible par authenticated';
  assert not has_table_privilege('authenticated','public.bareme_cachets','update'), 'bareme_cachets modifiable par authenticated';

  raise notice 'PASS: barème par équipe — copie atomique et idempotente, référence intacte, équipes isolées, majorations rattachées, droits service_role';
end $test$;
rollback;
