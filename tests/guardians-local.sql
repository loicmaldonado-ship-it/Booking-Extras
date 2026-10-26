do $test$
declare child uuid:=gen_random_uuid(); invited uuid:=gen_random_uuid(); adult uuid:=gen_random_uuid(); unknown uuid:=gen_random_uuid();
 today date:=(now() at time zone 'Europe/Paris')::date; pwd text:=repeat('a',32)||':'||repeat('b',128);
 parents jsonb:='{"first":{"prenom":"Parent","nom":"Un","adresse":"1 rue de Test","telephone":"0600000001","email":"parent1@example.test"},"second":{"prenom":"Parent","nom":"Deux","adresse":"2 rue de Test","telephone":"0600000002","email":"parent2@example.test"}}';
 bad jsonb; result uuid;
begin begin
 insert into public.figurants(id,prenom,nom,email,date_naissance,acces_compte) values
 (child,'Mineur','Fixture','child@example.test',(today-interval '17 years')::date,true),
 (invited,'Invitation','Mineure','invited@example.test',null,false),
 (adult,'Majeur','Fixture','adult@example.test',(today-interval '18 years')::date,true),
 (unknown,'Age','Inconnu','unknown@example.test',null,true);
 set local role service_role;
 begin perform public.changer_mot_de_passe_candidat(child,pwd); raise exception using errcode='ZX002',message='Compte mineur sans parents accepté'; exception when raise_exception then null; end;
 begin perform public.changer_mot_de_passe_candidat(unknown,pwd); raise exception using errcode='ZX002',message='Compte sans naissance accepté'; exception when raise_exception then null; end;
 perform public.changer_mot_de_passe_candidat(adult,pwd);
 assert not exists(select 1 from public.minor_guardians where figurant_id=adult),'Collecte de parents pour un majeur';
 perform public.save_minor_guardians(child,parents);
 assert public.minor_guardians_complete(child),'Deux représentants valides refusés';
 bad:=jsonb_set(parents,'{first,email}','"CHILD@example.test"');
 begin perform public.save_minor_guardians(child,bad); raise exception using errcode='ZX002',message='Email enfant réutilisé'; exception when raise_exception then null; end;
 assert (select email='parent1@example.test' from public.minor_guardians where figurant_id=child and position=1),'Rollback des parents échoué';
 bad:=jsonb_set(parents,'{second,email}','"PARENT1@example.test"');
 begin perform public.save_minor_guardians(child,bad); raise exception using errcode='ZX002',message='Emails parents identiques acceptés'; exception when raise_exception then null; end;
 bad:=parents-'second';
 begin perform public.save_minor_guardians(child,bad); raise exception using errcode='ZX002',message='Second parent absent accepté'; exception when raise_exception then null; end;
 bad:=jsonb_set(parents,'{second}','{"absence_reason":"autre"}');
 begin perform public.save_minor_guardians(child,bad); raise exception using errcode='ZX002',message='Motif non prévu accepté'; exception when check_violation then null; end;
 bad:=jsonb_set(parents,'{second}','{"absence_reason":"decede"}');
 perform public.save_minor_guardians(child,bad);
 assert public.minor_guardians_complete(child),'Exception décès refusée';
 assert (select email is null and nom is null from public.minor_guardians where figurant_id=child and position=2),'PII second parent conservées';
 bad:=jsonb_set(parents,'{second}','{"absence_reason":"sans_autorite"}');
 perform public.save_minor_guardians(child,bad);
 assert public.minor_guardians_complete(child),'Exception autorité refusée';
 perform public.changer_mot_de_passe_candidat(child,pwd);
 delete from public.minor_guardians where figurant_id=child;
 begin insert into public.candidatures(figurant_id,annonce_id) values(child,'00000000-0000-4000-8000-00000000a000');
  raise exception using errcode='ZX002',message='Candidature mineure incomplète acceptée'; exception when raise_exception then null; end;
 perform public.save_minor_guardians(child,parents);
 insert into public.candidatures(figurant_id,annonce_id) values(child,'00000000-0000-4000-8000-00000000a000');
 insert into public.figurant_auth_tokens(figurant_id,token,objet,expires_at) values(invited,repeat('c',32),'creation_compte',now()+interval '1 hour');
 begin perform public.activer_compte_invitation(repeat('c',32),pwd,(today-interval '15 years')::date,null);
  raise exception using errcode='ZX002',message='Invitation mineure sans parents acceptée'; exception when raise_exception then null; end;
 assert (select used_at is null from public.figurant_auth_tokens where token=repeat('c',32)),'Invitation consommée malgré échec';
 assert not exists(select 1 from public.figurant_comptes where figurant_id=invited),'Compte partiel créé';
 result:=public.activer_compte_invitation(repeat('c',32),pwd,(today-interval '15 years')::date,parents);
 assert result=invited and public.minor_guardians_complete(invited),'Activation mineure valide échouée';
 reset role;
 assert not has_table_privilege('anon','public.minor_guardians','select'),'Contacts parents publics';
 assert not has_table_privilege('authenticated','public.minor_guardians','select'),'Contacts parents accessibles au rôle générique';
 assert not has_function_privilege('authenticated','public.save_minor_guardians(uuid,jsonb)','execute'),'RPC parents publique';
 raise exception using errcode='ZX001',message='Rollback fixtures';
exception when sqlstate 'ZX001' then raise notice 'PASS parents, trois emails distincts, exceptions prévues, rollback, compte/candidature/activation mineur et confidentialité; fixtures annulées'; end;
end $test$;
