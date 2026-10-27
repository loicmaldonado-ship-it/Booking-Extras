-- Même encodage de composant que encodeURIComponent, sans extension réseau.
create function public.casting_path_component(p_value text)
returns text language sql immutable strict security invoker set search_path='' as $fn$
 select coalesce(string_agg(case when byte between 65 and 90 or byte between 97 and 122 or byte between 48 and 57 or byte in(45,95,46,33,126,42,39,40,41) then chr(byte) else '%'||upper(lpad(to_hex(byte),2,'0')) end,'' order by position),'')
 from (select position,get_byte(convert_to(p_value,'UTF8'),position) as byte from generate_series(0,octet_length(convert_to(p_value,'UTF8'))-1) as positions(position)) as bytes;
$fn$;
revoke all on function public.casting_path_component(text) from public,anon,authenticated;
grant execute on function public.casting_path_component(text) to service_role;

create function public.finaliser_casting_atomique(p_token uuid,p_videos text[],p_photos jsonb,p_profile jsonb default '{}',p_demo text default null,p_reponses jsonb default '[]')
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare entry public.casting_entries; person public.figurants; role public.casting_roles; fields public.figurants; photo jsonb; response jsonb; question text; path text; prefix text; matched text[]; existing_link uuid; used_slots numeric[]:='{}';
 uuid_pattern constant text:='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
begin
 select * into entry from public.casting_entries where request_token=p_token;
 if not found then raise exception 'Ce lien de casting n’est plus valide' using errcode='42501'; end if;
 -- Ordre commun aux opérations RGPD : profil, puis entrée. Tout est revérifié
 -- après le verrou : une fusion ou une finalisation concurrente ne peut passer.
 select * into person from public.figurants where id=entry.figurant_id for update;
 if not found or person.anonymise or person.anonymisation_en_cours_at is not null then raise exception 'Profil indisponible' using errcode='42501'; end if;
 select * into entry from public.casting_entries where id=entry.id and request_token=p_token and figurant_id=person.id for update;
 if not found then raise exception 'Ce lien de casting a changé' using errcode='42501'; end if;
 if entry.submitted_at is not null or entry.statut in('attente_validation','valide','confirmé','indisponible','annulé') then raise exception 'Ce casting a déjà été transmis ou clôturé' using errcode='23514'; end if;
 select * into role from public.casting_roles where id=entry.role_id and projet_id=entry.projet_id for share;
 if not found then raise exception 'Rôle de casting indisponible' using errcode='23514'; end if;
 if role.date_limite_envoi is not null and role.date_limite_envoi<(now() at time zone 'UTC')::date then raise exception 'La date limite d’envoi est passée' using errcode='23514'; end if;
 if p_videos is null or jsonb_typeof(p_photos) is distinct from 'array' or cardinality(p_videos)>coalesce(role.nb_videos,1) or (coalesce(role.nb_videos,1)>0 and cardinality(p_videos)=0) or jsonb_array_length(p_photos)<>coalesce(cardinality(role.photo_labels),0) then raise exception 'Nombre de fichiers de casting invalide' using errcode='23514'; end if;
 if (select count(distinct value) from unnest(p_videos) as values(value))<>cardinality(p_videos) or (select count(distinct value->>'label') from jsonb_array_elements(p_photos))<>jsonb_array_length(p_photos) then raise exception 'Fichiers de casting dupliqués' using errcode='23514'; end if;
 foreach path in array p_videos loop
  prefix:=person.id::text||'/'||entry.id::text||'-video-';
  if path is null or not starts_with(path,prefix) then raise exception 'Chemin vidéo non autorisé' using errcode='23514'; end if;
  matched:=regexp_match(substr(path,length(prefix)+1),'(?i)^([0-9]+)-'||uuid_pattern||'\.mp4$');
  if matched is null or matched[1]::numeric>=coalesce(role.nb_videos,1) then raise exception 'Créneau vidéo non autorisé' using errcode='23514'; end if;
  if matched[1]::numeric=any(used_slots) then raise exception 'Créneau vidéo dupliqué' using errcode='23514'; end if;
  used_slots:=array_append(used_slots,matched[1]::numeric);
  perform 1 from storage.objects where bucket_id='casting-videos' and name=path for share;
  if not found then raise exception 'Vidéo absente du stockage' using errcode='23514'; end if;
 end loop;
 for photo in select value from jsonb_array_elements(p_photos) loop
  if jsonb_typeof(photo->'label') is distinct from 'string' or jsonb_typeof(photo->'path') is distinct from 'string' or not coalesce((photo->>'label')=any(coalesce(role.photo_labels,'{}')),false) then raise exception 'Libellé photo non autorisé' using errcode='23514'; end if;
  path:=photo->>'path';prefix:=person.id::text||'/casting-'||entry.id::text||'-'||public.casting_path_component(photo->>'label')||'-';
  if not starts_with(path,prefix) or substr(path,length(prefix)+1)!~*('^'||uuid_pattern||'\.jpg$') then raise exception 'Chemin photo non autorisé' using errcode='23514'; end if;
  perform 1 from storage.objects where bucket_id='figurant-photos' and name=path for share;
  if not found then raise exception 'Photo absente du stockage' using errcode='23514'; end if;
 end loop;
 p_profile:=coalesce(p_profile,'{}');p_reponses:=coalesce(p_reponses,'[]');
 if jsonb_typeof(p_profile)<>'object' or exists(select 1 from jsonb_object_keys(p_profile) as keys(key) where key<>all(array['date_naissance','genre','code_postal','ville','taille_cm','poids_kg','pointure','veste','pantalon'])) then raise exception 'Champs de fiche non autorisés' using errcode='23514'; end if;
 fields:=jsonb_populate_record(null::public.figurants,p_profile);
 if (p_profile?'date_naissance' and (fields.date_naissance is null or fields.date_naissance>=(now() at time zone 'UTC')::date)) or (p_profile?'genre' and coalesce(fields.genre,'')<>all(array['Femme','Homme','Non-binaire','Autre'])) or (p_profile?'taille_cm' and coalesce(fields.taille_cm,0) not between 50 and 250) or (p_profile?'poids_kg' and coalesce(fields.poids_kg,0) not between 10 and 300) or (p_profile?'pointure' and coalesce(fields.pointure,0) not between 15 and 60) or length(fields.code_postal)>10 or length(fields.ville)>80 or length(fields.veste)>20 or length(fields.pantalon)>20 then raise exception 'Fiche de casting invalide' using errcode='23514'; end if;
 if jsonb_typeof(p_reponses) is distinct from 'array' or jsonb_array_length(p_reponses)<>coalesce(cardinality(role.questions),0) then raise exception 'Réponds à toutes les questions' using errcode='23514'; end if;
 foreach question in array coalesce(role.questions,'{}') loop
  select value into response from jsonb_array_elements(p_reponses) where value->>'question'=question limit 1;
  if not found or coalesce(response->>'reponse','') not in('oui','non') or length(response->>'precision')>200 then raise exception 'Réponse de casting invalide' using errcode='23514'; end if;
 end loop;
 if role.demande_bande_demo and p_demo is not null and btrim(p_demo)<>'' and p_demo!~*'^https?://[^[:space:]]+$' then raise exception 'Lien de bande démo invalide' using errcode='23514'; end if;
 -- Aucune écriture métier avant la fin de toutes les vérifications.
 for photo in select value from jsonb_array_elements(p_photos) loop
  insert into public.figurant_photos(figurant_id,type,storage_path,projet_id,casting_entry_id,label) values(person.id,'casting',photo->>'path',entry.projet_id,entry.id,photo->>'label');
 end loop;
 if p_profile<>'{}'::jsonb then
  update public.figurants set
   date_naissance=case when p_profile?'date_naissance' then fields.date_naissance else date_naissance end,
   genre=case when p_profile?'genre' then fields.genre else genre end,
   code_postal=case when p_profile?'code_postal' then fields.code_postal else code_postal end,
   ville=case when p_profile?'ville' then fields.ville else ville end,
   taille_cm=case when p_profile?'taille_cm' then fields.taille_cm else taille_cm end,
   poids_kg=case when p_profile?'poids_kg' then fields.poids_kg else poids_kg end,
   pointure=case when p_profile?'pointure' then fields.pointure else pointure end,
   veste=case when p_profile?'veste' then fields.veste else veste end,
   pantalon=case when p_profile?'pantalon' then fields.pantalon else pantalon end where id=person.id;
 end if;
 if role.demande_bande_demo and p_demo is not null and btrim(p_demo)<>'' then
  select id into existing_link from public.figurant_liens where figurant_id=person.id and label='Bande démo' order by created_at,id limit 1 for update;
  if found then update public.figurant_liens set url=btrim(p_demo) where id=existing_link;
  else insert into public.figurant_liens(figurant_id,label,url) values(person.id,'Bande démo',btrim(p_demo)); end if;
 end if;
 update public.casting_entries set video_storage_paths=p_videos,submitted_at=now(),statut=case when statut='proposé' then 'envoyé' else statut end,reponses=case when coalesce(cardinality(role.questions),0)>0 then p_reponses else reponses end where id=entry.id;
 insert into public.notifications(type,titre,figurant_id,projet_id,lien) values('casting',person.prenom||' '||upper(person.nom)||' a envoyé sa vidéo/photos pour « '||role.nom||' »',person.id,entry.projet_id,'/casting');
 return true;
end $fn$;
revoke all on function public.finaliser_casting_atomique(uuid,text[],jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.finaliser_casting_atomique(uuid,text[],jsonb,jsonb,text,jsonb) to service_role;
notify pgrst,'reload schema';
