do $test$
declare child uuid:=gen_random_uuid(); today date:=(now() at time zone 'Europe/Paris')::date;
 parents jsonb:='{"first":{"prenom":"Parent","nom":"Un","adresse":"1 rue de Test","telephone":"0600000001","email":"parent1@example.test"},"second":{"absence_reason":"sans_autorite"}}';
begin begin
 insert into public.figurants(id,prenom,nom,email,date_naissance) values(child,'Fixture','Identite','identity@example.test',(today-interval '20 years')::date);
 set local role service_role;
 perform public.changer_mot_de_passe_candidat(child,repeat('a',32)||':'||repeat('b',128));
 begin
  perform public.update_candidate_identity(child,'parent1@example.test',(today-interval '17 years')::date,parents);
  raise exception using errcode='ZX002',message='Identité invalide acceptée';
 exception when raise_exception then null; end;
 assert (select email='identity@example.test' and date_naissance=(today-interval '20 years')::date from public.figurants where id=child),'Identité partiellement enregistrée';
 perform public.update_candidate_identity(child,'identity@example.test',(today-interval '17 years')::date,parents);
 set constraints minor_identity_update immediate;
 assert public.minor_guardians_complete(child),'Transition adulte vers mineur incomplète';
 begin
  update public.figurants set email='PARENT1@example.test' where id=child;
  raise exception using errcode='ZX002',message='Modification directe vers email parental acceptée';
 exception when raise_exception then null; end;
 assert (select email='identity@example.test' from public.figurants where id=child),'Email changé malgré le refus';
 reset role;
 assert not has_function_privilege('anon','public.update_candidate_identity(uuid,text,date,jsonb)','execute'),'Identité publique';
 assert not has_function_privilege('authenticated','public.update_candidate_identity(uuid,text,date,jsonb)','execute'),'Identité modifiable directement';
 raise exception using errcode='ZX001',message='Rollback fixtures';
exception when sqlstate 'ZX001' then raise notice 'PASS identité atomique, transition vers mineur, écriture directe invalide refusée et permissions; fixtures annulées'; end;
end $test$;
