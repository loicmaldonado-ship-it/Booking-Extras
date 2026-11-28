do $test$
declare actors uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; projects uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; days uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; slots uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; people uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; entries uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; sessions uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; i integer; other integer; n integer; extra uuid;
begin begin
 perform set_config('request.jwt.claim.role','service_role',true);
 for i in 1..2 loop
  insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data) values(actors[i],'casting-'||actors[i]::text||'@example.test','authenticated','authenticated','{}','{}');
  update public.profiles set role='chef',is_owner=false where id=actors[i];
  insert into public.projets(id,nom,owner_id) values(projects[i],'Casting RLS fictif '||i,actors[i]);
  insert into public.figurants(id,prenom,nom,date_naissance,temporaire_projet_id,acces_compte) values(people[i],'Casting','Fictif '||i,'1990-01-01',projects[i],false);
  insert into public.casting_presentiel_journees(id,projet_id,date) values(days[i],projects[i],current_date+20);
  insert into public.casting_presentiel_creneaux(id,journee_id,heure_debut,heure_fin) values(slots[i],days[i],'10:00','11:00');
  insert into public.casting_presentiel_entries(id,projet_id,journee_id,creneau_id,figurant_id) values(entries[i],projects[i],days[i],slots[i],people[i]);
  insert into auth.sessions(id,user_id,created_at) values(sessions[i],actors[i],now());
 end loop;
 for i in 1..2 loop
  other:=3-i;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actors[i],'role','authenticated','session_id',sessions[i])::text,true);
  set local role authenticated;
  assert not public.is_owner(),'Chef de fixture propriétaire global';
  assert public.has_projet_access(projects[i]) and not public.has_projet_access(projects[other]),'Périmètre projet incorrect';
  assert (select count(*)=1 from public.casting_presentiel_creneaux where id=slots[i]),'Créneau local invisible';
  assert not exists(select 1 from public.casting_presentiel_creneaux where id=slots[other]),'Créneau étranger visible';
  assert (select count(*)=1 from public.casting_presentiel_entries where id=entries[i]),'Entrée locale invisible';
  assert not exists(select 1 from public.casting_presentiel_entries where id=entries[other]),'Entrée étrangère visible';
  begin insert into public.casting_presentiel_creneaux(journee_id,heure_debut,heure_fin) values(days[other],'12:00','13:00'); raise exception using errcode='ZX002',message='INSERT créneau étranger autorisé'; exception when insufficient_privilege then null; end;
  begin insert into public.casting_presentiel_entries(projet_id,journee_id,creneau_id,figurant_id) values(projects[other],days[other],slots[other],people[i]); raise exception using errcode='ZX002',message='INSERT entrée étrangère autorisé'; exception when insufficient_privilege then null; end;
  update public.casting_presentiel_creneaux set capacite=99 where id=slots[other];get diagnostics n=row_count;assert n=0,'UPDATE créneau étranger autorisé';
  update public.casting_presentiel_entries set notes='INTRUSION' where id=entries[other];get diagnostics n=row_count;assert n=0,'UPDATE entrée étrangère autorisé';
  delete from public.casting_presentiel_creneaux where id=slots[other];get diagnostics n=row_count;assert n=0,'DELETE créneau étranger autorisé';
  delete from public.casting_presentiel_entries where id=entries[other];get diagnostics n=row_count;assert n=0,'DELETE entrée étrangère autorisé';
  begin update public.casting_presentiel_creneaux set journee_id=days[other] where id=slots[i]; raise exception using errcode='ZX002',message='Transfert créneau étranger autorisé'; exception when insufficient_privilege or foreign_key_violation then null; end;
  begin update public.casting_presentiel_entries set projet_id=projects[other],journee_id=days[other],creneau_id=slots[other] where id=entries[i]; raise exception using errcode='ZX002',message='Transfert entrée étrangère autorisé'; exception when insufficient_privilege or foreign_key_violation then null; end;
  update public.casting_presentiel_entries set notes='Autorisé' where id=entries[i];get diagnostics n=row_count;assert n=1,'UPDATE local refusé';
  delete from public.casting_presentiel_entries where id=entries[i];get diagnostics n=row_count;assert n=1,'DELETE local refusé';
  insert into public.casting_presentiel_entries(id,projet_id,journee_id,creneau_id,figurant_id) values(entries[i],projects[i],days[i],slots[i],people[i]);
  extra:=gen_random_uuid();insert into public.casting_presentiel_creneaux(id,journee_id,heure_debut,heure_fin) values(extra,days[i],'12:00','13:00');
  update public.casting_presentiel_creneaux set capacite=2 where id=extra;get diagnostics n=row_count;assert n=1,'UPDATE créneau local refusé';
  delete from public.casting_presentiel_creneaux where id=extra;get diagnostics n=row_count;assert n=1,'DELETE créneau local refusé';
  reset role;
 end loop;
 assert (select count(*)=2 from public.casting_presentiel_entries where id=any(entries)),'Données interéquipes modifiées';
 assert not exists(select 1 from public.casting_presentiel_entries where id=any(entries) and notes='INTRUSION'),'Modification interéquipes persistée';
 assert not exists(select 1 from pg_policies where schemaname='public' and tablename in('casting_presentiel_entries','casting_presentiel_creneaux') and policyname='authenticated full access'),'Ancienne policy large restante';
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then null; end;
end $test$;
