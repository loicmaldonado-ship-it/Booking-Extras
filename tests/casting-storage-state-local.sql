do $test$
declare person uuid:=gen_random_uuid(); project uuid:=gen_random_uuid(); role_id uuid:=gen_random_uuid(); entry_id uuid:=gen_random_uuid(); photo text; video text; future_day date:=current_date+1;
begin begin
 insert into public.projets(id,nom,owner_id) values(project,'Storage casting fictif','00000000-0000-4000-8000-00000000c0c0');
 insert into public.figurants(id,prenom,nom,date_naissance) values(person,'Casting','Storage fictif','1990-01-01');
 insert into public.casting_roles(id,projet_id,nom,nb_videos,photo_labels,date_limite_envoi) values(role_id,project,'Rôle fictif',1,array['Portrait'],future_day);
 insert into public.casting_entries(id,projet_id,figurant_id,role_id) values(entry_id,project,person,role_id);
 photo:=person::text||'/casting-'||entry_id::text||'-Portrait-'||gen_random_uuid()::text||'.jpg';
 video:=person::text||'/'||entry_id::text||'-video-0-'||gen_random_uuid()::text||'.mp4';
 insert into storage.objects(bucket_id,name) values('figurant-photos',photo),('casting-videos',video);
 update public.casting_entries set submitted_at=now() where id=entry_id;
 begin insert into storage.objects(bucket_id,name) values('figurant-photos',person::text||'/casting-'||entry_id::text||'-Portrait-'||gen_random_uuid()::text||'.jpg'); raise exception using errcode='ZX002',message='Photo tardive acceptée'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('casting-videos',person::text||'/'||entry_id::text||'-video-1-'||gen_random_uuid()::text||'.mp4'); raise exception using errcode='ZX002',message='Vidéo tardive acceptée'; exception when insufficient_privilege then null; end;
 begin update storage.objects set metadata='{}' where bucket_id='figurant-photos' and name=photo; raise exception using errcode='ZX002',message='Remplacement public tardif accepté'; exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values('figurant-photos',person::text||'/casting-Portrait-'||gen_random_uuid()::text||'.jpg'),('casting-videos',person::text||'/'||entry_id::text||'-video-'||gen_random_uuid()::text||'.mp4');
 update public.casting_entries set submitted_at=null,statut='valide' where id=entry_id;
 begin insert into storage.objects(bucket_id,name) values('figurant-photos',person::text||'/casting-'||entry_id::text||'-Portrait-'||gen_random_uuid()::text||'.jpg'); raise exception using errcode='ZX002',message='Statut validé ignoré'; exception when insufficient_privilege then null; end;
 update public.casting_entries set statut='proposé' where id=entry_id;
 update public.casting_roles set date_limite_envoi=current_date-1 where id=role_id;
 begin insert into storage.objects(bucket_id,name) values('casting-videos',person::text||'/'||entry_id::text||'-video-0-'||gen_random_uuid()::text||'.mp4'); raise exception using errcode='ZX002',message='Deadline ignorée'; exception when insufficient_privilege then null; end;
 assert not has_function_privilege('authenticated','public.enforce_public_casting_storage_state()','EXECUTE'),'Fonction interne publique';
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then null; end;
end $test$;
