do $test$
declare n integer;
begin
 begin
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
  values ('00000000-0000-4000-8000-00000000b002','isolation@example.test','authenticated','authenticated','{}','{}');
  update public.profiles set role='chef',is_owner=false where id='00000000-0000-4000-8000-00000000b002';
  insert into public.projets(id,nom,owner_id) values ('00000000-0000-4000-8000-00000000b003','Isolation test','00000000-0000-4000-8000-00000000b002');
  insert into public.figurants(id,prenom,nom,confirme,acces_compte,temporaire_projet_id) values
   ('00000000-0000-4000-8000-00000000b004','Privé','Autre équipe',true,false,'00000000-0000-4000-8000-00000000b003'),
   ('00000000-0000-4000-8000-00000000b005','Privé','Équipe courante',true,false,'00000000-0000-4000-8000-0000000070e0');
  insert into public.figurants(id,prenom,nom,confirme,acces_compte,est_comedien,comedien_pool_id) values
   ('00000000-0000-4000-8000-00000000b006','Comédien','Pool étranger',true,true,true,'00000000-0000-4000-8000-00000000b002'),
   ('00000000-0000-4000-8000-00000000b007','Comédien','Sans pool',true,true,true,null);
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a551","role":"authenticated"}',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  select count(*) into n from public.projets where id='00000000-0000-4000-8000-0000000070e0';
  assert n=1,'Projet membre invisible';
  select count(*) into n from public.projets where id='00000000-0000-4000-8000-00000000b003';
  assert n=0,'Fuite projet étranger';
  select count(*) into n from public.figurants where id in ('00000000-0000-4000-8000-00000000b004','00000000-0000-4000-8000-00000000b006','00000000-0000-4000-8000-00000000b007');
  assert n=0,'Fuite profil sans compte ou comédien étranger';
  select count(*) into n from public.figurants where id='00000000-0000-4000-8000-00000000b005';
  assert n=1,'Ajout rapide du projet membre invisible';
  begin
   update public.profiles set is_owner=true where id='00000000-0000-4000-8000-00000000a551';
   raise exception 'Escalade autorisée';
  exception when insufficient_privilege then null;
  end;
  begin
   select count(*) into n from public.figurant_comptes;
   assert n=0,'Lecture des mots de passe autorisée';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('request.jwt.claim.role','anon',true);
  set local role anon;
  begin
   select count(*) into n from public.figurants;
   assert n=0,'Lecture publique des profils';
  exception when insufficient_privilege then null;
  end;
  begin
   select count(*) into n from public.figurant_sessions;
   assert n=0,'Lecture publique des sessions autorisée';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise exception using errcode='ZX001',message='ROLLBACK des seules données de recette';
 exception when sqlstate 'ZX001' then
  raise notice 'PASS: projet membre, projet étranger, profils privés, comédiens, ajout rapide, escalade, mots de passe, anon, sessions; fixtures annulées';
 end;
end $test$;
