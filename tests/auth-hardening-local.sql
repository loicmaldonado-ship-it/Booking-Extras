do $test$
declare i integer; fid uuid:='00000000-0000-4000-8000-00000000b200'; renewed jsonb; expected text:=repeat('a',32)||':'||repeat('b',128);
begin begin
 delete from public.candidate_auth_attempts;
 for i in 1..6 loop assert public.consume_candidate_auth_limits(repeat('1',64),repeat('2',64),repeat('3',64)),'Tentative autorisée refusée'; end loop;
 assert not public.consume_candidate_auth_limits(repeat('1',64),repeat('2',64),repeat('3',64)),'Septième tentative autorisée';
 assert not public.consume_candidate_auth_limits(repeat('1',64),repeat('4',64),repeat('5',64)),'Changement IP contourne quota compte';
 update public.candidate_auth_attempts set period_started_at=now()-interval '16 minutes';
 assert public.consume_candidate_auth_limits(repeat('1',64),repeat('2',64),repeat('3',64)),'Fenêtre expirée non réouverte';
 delete from public.candidate_auth_attempts;
 for i in 1..60 loop
  assert public.consume_candidate_auth_limits(lpad(to_hex(i),64,'0'),repeat('a',64),lpad(to_hex(i+10000),64,'0')),'Quota réseau prématuré';
 end loop;
 assert not public.consume_candidate_auth_limits(repeat('b',64),repeat('a',64),repeat('c',64)),'Rotation emails contourne quota IP';
 assert not public.consume_candidate_auth_limits(null,repeat('a',64),repeat('b',64)),'Clé nulle acceptée';
 assert not has_function_privilege('anon','public.consume_candidate_auth_limits(text,text,text)','execute');
 assert not has_function_privilege('authenticated','public.changer_mot_de_passe_candidat(uuid,text,boolean,text)','execute');

 insert into public.figurants(id,prenom,nom,acces_compte) values(fid,'Session','Test',true);
 insert into public.figurant_sessions(figurant_id,token,expires_at) values(fid,repeat('d',32),now()+interval '1 hour'),(fid,repeat('e',32),now()+interval '1 hour');
 insert into public.figurant_auth_tokens(figurant_id,token,objet,expires_at) values(fid,repeat('f',32),'connexion',now()+interval '1 hour');
 set local role service_role;
 perform public.changer_mot_de_passe_candidat(fid,expected);
 assert not exists(select 1 from public.figurant_sessions where figurant_id=fid),'Ancienne session encore active';
 assert not exists(select 1 from public.figurant_auth_tokens where figurant_id=fid),'Ancien lien encore actif';
 assert (select password_hash=expected from public.figurant_comptes where figurant_id=fid),'Hash non écrit';
 insert into public.figurant_sessions(figurant_id,token,expires_at) values(fid,repeat('d',32),now()+interval '1 hour');
 renewed:=public.changer_mot_de_passe_candidat(fid,expected,true,repeat('d',32));
 assert (select count(*)=1 from public.figurant_sessions where figurant_id=fid),'Renouvellement non atomique';
 assert (select token=renewed->>'token' from public.figurant_sessions where figurant_id=fid),'Token nouveau incorrect';
 perform public.changer_mot_de_passe_candidat(fid,expected,true,renewed->>'token');
 assert not exists(select 1 from public.figurant_sessions where token=renewed->>'token'),'Session précédente non révoquée';
 begin
  perform public.changer_mot_de_passe_candidat(fid,expected,true,renewed->>'token');
  raise exception using errcode='ZX002',message='Ancienne session réutilisée';
 exception when raise_exception then null; end;
 reset role;

 insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('00000000-0000-4000-8000-00000000b201','00000000-0000-4000-8000-00000000a551',now(),now()),
 ('00000000-0000-4000-8000-00000000b202','00000000-0000-4000-8000-00000000a551',now()-interval '61 minutes',now()),
 ('00000000-0000-4000-8000-00000000b203','00000000-0000-4000-8000-00000000c0c0',now(),now());
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a551","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b201"}',true);
 set local role authenticated;
 assert public.staff_session_is_current(),'Session récente refusée';
 assert (select count(*)=1 from public.projets where id='00000000-0000-4000-8000-0000000070e0'),'REST/RLS active refusée';
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a551","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b202"}',true);
 assert not public.staff_session_is_current(),'Session expirée acceptée';
 assert (select count(*)=0 from public.profiles),'Lecture directe après expiration autorisée';
 assert not public.has_projet_access('00000000-0000-4000-8000-0000000070e0'),'RPC après expiration autorisée';
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a551","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b203"}',true);
 assert not public.staff_session_is_current(),'Session autre utilisateur acceptée';
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a551","role":"authenticated"}',true);
 assert not public.staff_session_is_current(),'JWT sans session accepté';
 reset role;
 raise exception using errcode='ZX001',message='Rollback fixtures';
exception when sqlstate 'ZX001' then raise notice 'PASS anti-abus IP/compte, rotation IP/emails, reset fenêtre, révocation sessions/liens, durée et identité session staff; fixtures annulées';
end; end $test$;
