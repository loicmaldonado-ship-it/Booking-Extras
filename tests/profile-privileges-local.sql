do $test$
declare actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); expr text; n integer;
begin begin
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into auth.users(id,email,aud,role,raw_user_meta_data) values(actor,'privilege-'||actor::text||'@example.test','authenticated','authenticated','{"role":"chef","is_owner":true,"acces_complet":true}');
 insert into auth.users(id,email,aud,role) values(other_actor,'privilege-other-'||other_actor::text||'@example.test','authenticated','authenticated');
 delete from public.profiles where id=other_actor;
 assert (select role='assistant' and not is_owner and not acces_complet from public.profiles where id=actor),'User metadata used as privileges';
 insert into auth.sessions(id,user_id,created_at) values(sid,actor,now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',sid)::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 set local role authenticated;
 assert exists(select 1 from public.profiles where id=actor),'Own profile invisible';
 foreach expr in array array[
  'acces_complet=true','role=''chef''','is_owner=true',
  'comedien_pool_id='''||other_actor::text||'''::uuid',
  'sections_autorisees=ARRAY[''figurants'',''projets'']::text[]',
  'gmail_smtp_user=''fixture@example.test''','gmail_smtp_app_password=''fixture-only''',
  'email_espace_perso_template=''fixture''','email_magic_link_template=''fixture''',
  'email=''owner-forged@example.test''','id='''||other_actor::text||'''::uuid'
 ] loop
  begin
   execute 'update public.profiles set '||expr||' where id=$1' using actor;
   raise exception using errcode='ZX002',message='Protected field writable: '||expr;
  exception when insufficient_privilege then null;end;
 end loop;
 begin
  insert into public.profiles(id,role,acces_complet) values(other_actor,'chef',true);
  raise exception using errcode='ZX002',message='Privileged profile INSERT allowed';
 exception when insufficient_privilege then null;end;
 update public.profiles set nom='Fixture',prenom='Fixture',telephone='0600000000' where id=actor;
 get diagnostics n=row_count;assert n=1,'Legitimate personal edit broken';
 assert not public.is_owner() and not public.is_chef(),'Privileges changed despite refusals';
 reset role;
 perform set_config('request.jwt.claim.role','service_role',true);
 set local role service_role;
 update public.profiles set role='chef',acces_complet=true,sections_autorisees=array['figurants'] where id=actor;
 assert (select role='chef' and acces_complet from public.profiles where id=actor),'Administrative service edit broken';
 reset role;
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then raise notice 'PASS: protected fields, insert, metadata, personal and service edits; fixtures rolled back';end;
end $test$;
