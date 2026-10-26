do $test$
declare subject uuid:=gen_random_uuid();
begin begin
 insert into public.figurants(id,prenom,nom,acces_compte) values(subject,'Révocation','Fixture',true);
 execute format('create function pg_temp.fail_revocation_fixture() returns trigger language plpgsql as $guard$ begin if old.figurant_id=%L::uuid then raise exception using errcode=''ZX003'',message=''fixture panne suppression''; end if; return old; end $guard$',subject::text);
 create trigger fixture_revocation_failure before delete on public.figurant_auth_tokens for each row execute function pg_temp.fail_revocation_fixture();
 set local role service_role;
 insert into public.figurant_sessions(figurant_id,token,expires_at) values(subject,gen_random_uuid()::text,now()+interval '7 days');
 insert into public.figurant_auth_tokens(figurant_id,token,expires_at,objet) values(subject,gen_random_uuid()::text,now()+interval '1 hour','connexion'),(subject,gen_random_uuid()::text,now()+interval '1 hour','creation_compte');
 begin
  update public.figurants set acces_compte=false where id=subject;
  raise exception using errcode='ZX002',message='Panne non propagée';
 exception when sqlstate 'ZX003' then null; end;
 assert (select acces_compte from public.figurants where id=subject),'Accès partiellement révoqué après panne';
 assert (select count(*)=1 from public.figurant_sessions where figurant_id=subject),'Session supprimée malgré rollback';
 assert (select count(*)=2 from public.figurant_auth_tokens where figurant_id=subject),'Liens supprimés malgré rollback';
 reset role;
 drop trigger fixture_revocation_failure on public.figurant_auth_tokens;
 set local role service_role;
 update public.figurants set acces_compte=false where id=subject;
 assert not exists(select 1 from public.figurant_sessions where figurant_id=subject),'Sessions encore présentes';
 assert not exists(select 1 from public.figurant_auth_tokens where figurant_id=subject),'Jetons encore présents';
 begin insert into public.figurant_sessions(figurant_id,token,expires_at) values(subject,gen_random_uuid()::text,now()+interval '7 days'); raise exception using errcode='ZX002',message='Session après révocation acceptée'; exception when insufficient_privilege then null; end;
 begin insert into public.figurant_auth_tokens(figurant_id,token,expires_at,objet) values(subject,gen_random_uuid()::text,now()+interval '1 hour','connexion'); raise exception using errcode='ZX002',message='Connexion après révocation acceptée'; exception when insufficient_privilege then null; end;
 -- Une fiche rapide sans compte conserve son flux d’invitation explicite.
 insert into public.figurant_auth_tokens(figurant_id,token,expires_at,objet) values(subject,gen_random_uuid()::text,now()+interval '1 hour','creation_compte');
 update public.figurants set acces_compte=true where id=subject;
 insert into public.figurant_sessions(figurant_id,token,expires_at) values(subject,gen_random_uuid()::text,now()+interval '7 days');
 assert (select count(*)=1 from public.figurant_sessions where figurant_id=subject),'Réactivation non fonctionnelle';
 assert not has_function_privilege('authenticated','public.revoke_candidate_credentials()','EXECUTE'),'Trigger appelable staff';
 assert not has_function_privilege('anon','public.enforce_candidate_access_for_credentials()','EXECUTE'),'Trigger appelable public';
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then null; end;
end $test$;
