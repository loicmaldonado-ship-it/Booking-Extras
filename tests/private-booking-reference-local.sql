do $test$
declare person uuid:=gen_random_uuid(); project uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); actor uuid:='00000000-0000-4000-8000-00000000a551'; normal uuid:=gen_random_uuid(); day uuid:=gen_random_uuid(); tbl text; row_id uuid; cast_role uuid:=gen_random_uuid(); annonce uuid:=gen_random_uuid();
begin begin
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into public.projets(id,nom,owner_id) values(project,'Private booking reference fixture','00000000-0000-4000-8000-00000000c0c0');
 insert into public.figurants(id,prenom,nom,date_naissance,acces_compte,est_comedien,comedien_pool_id,temporaire_projet_id) values(person,'Private','Fixture','1990-01-01',true,true,'00000000-0000-4000-8000-00000000c0c0',project);
 insert into public.figurant_comptes(figurant_id,password_hash) values(person,'fixture-no-login');
 insert into public.annonces(id,projet_id,titre) values(annonce,'00000000-0000-4000-8000-0000000070e0','Private references fixture');
 insert into public.figurants(id,prenom,nom,date_naissance,acces_compte,temporaire_projet_id) values(normal,'Visible','Fixture','1990-01-01',false,'00000000-0000-4000-8000-0000000070e0');
 insert into public.casting_presentiel_journees(id,projet_id,date) values(day,'00000000-0000-4000-8000-0000000070e0','2030-06-01');
 insert into public.casting_roles(id,projet_id,nom) values(cast_role,'00000000-0000-4000-8000-0000000070e0','Private references fixture');
 insert into auth.sessions(id,user_id,created_at) values(sid,actor,now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',sid)::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 set local role authenticated;
 assert not exists(select 1 from public.figurants where id=person),'Target already visible before test';
 begin
  insert into public.bookings(figurant_id,projet_id,date,fonction,cachet) values(person,'00000000-0000-4000-8000-0000000070e0','2030-06-01','Figuration','Figurant');
  raise exception using errcode='ZX002',message='Foreign private person attached to own project';
 exception when insufficient_privilege then null;end;
 foreach tbl in array array['bookings','essayages','casting_entries'] loop
  begin
   execute format('insert into public.%I(figurant_id,projet_id) values($1,$2)',tbl) using person,'00000000-0000-4000-8000-0000000070e0'::uuid;
   raise exception using errcode='ZX002',message='Hidden reference INSERT allowed in '||tbl;
  exception when insufficient_privilege then null;end;
  if tbl='bookings' then
   insert into public.bookings(figurant_id,projet_id,date,fonction,cachet) values(normal,'00000000-0000-4000-8000-0000000070e0','2030-06-01','Figuration','Figurant') returning id into row_id;
  elsif tbl='casting_entries' then
   insert into public.casting_entries(figurant_id,projet_id,role_id) values(normal,'00000000-0000-4000-8000-0000000070e0',cast_role) returning id into row_id;
  else
   execute format('insert into public.%I(figurant_id,projet_id) values($1,$2) returning id',tbl) into row_id using normal,'00000000-0000-4000-8000-0000000070e0'::uuid;
  end if;
  begin
   execute format('update public.%I set figurant_id=$1 where id=$2',tbl) using person,row_id;
   raise exception using errcode='ZX002',message='Hidden reference UPDATE allowed in '||tbl;
  exception when insufficient_privilege then null;end;
 end loop;
 begin
  insert into public.casting_presentiel_entries(figurant_id,projet_id,journee_id) values(person,'00000000-0000-4000-8000-0000000070e0',day);
  raise exception using errcode='ZX002',message='Hidden presentiel INSERT allowed';
 exception when insufficient_privilege then null;end;
 insert into public.casting_presentiel_entries(figurant_id,projet_id,journee_id) values(normal,'00000000-0000-4000-8000-0000000070e0',day) returning id into row_id;
 begin
  update public.casting_presentiel_entries set figurant_id=person where id=row_id;
  raise exception using errcode='ZX002',message='Hidden presentiel UPDATE allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.candidatures(figurant_id,annonce_id) values(person,annonce);
  raise exception using errcode='ZX002',message='Hidden candidature INSERT allowed';
 exception when insufficient_privilege then null;end;
 insert into public.candidatures(figurant_id,annonce_id) values('00000000-0000-4000-8000-00000000f001',annonce) returning id into row_id;
 begin
  update public.candidatures set figurant_id=person where id=row_id;
  raise exception using errcode='ZX002',message='Hidden candidature UPDATE allowed';
 exception when insufficient_privilege then null;end;
 reset role;
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then raise notice 'PASS private person booking reference refused; fixtures rolled back';end;
end $test$;
