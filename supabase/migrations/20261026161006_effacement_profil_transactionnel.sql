alter table public.figurants add column anonymisation_en_cours_at timestamptz;

create table public.rgpd_fichiers_a_effacer (
 figurant_id uuid not null references public.figurants(id) on delete restrict,
 bucket text not null check(bucket in ('figurant-photos','casting-videos','minor-documents')),
 path text not null check(length(path)>0),
 prepared_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(figurant_id,bucket,path)
);
create index rgpd_fichiers_actor on public.rgpd_fichiers_a_effacer(prepared_by);
alter table public.rgpd_fichiers_a_effacer enable row level security;
revoke all on table public.rgpd_fichiers_a_effacer from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.rgpd_fichiers_a_effacer to service_role;

create or replace function public.rgpd_media_paths(p_id uuid)
returns table(bucket text,path text) language sql stable security invoker set search_path='' as $fn$
 select s.bucket_id,s.name from storage.objects s where s.bucket_id in ('figurant-photos','casting-videos') and starts_with(s.name,p_id::text||'/')
 union select 'figurant-photos',p.storage_path from public.figurant_photos p where p.figurant_id=p_id
 union select 'casting-videos',unnest(e.video_storage_paths) from public.casting_entries e where e.figurant_id=p_id
 union select 'minor-documents',m.storage_path from public.minor_documents m join public.minor_dossiers d on d.id=m.dossier_id where d.figurant_id=p_id and m.storage_path is not null
 union select s.bucket_id,s.name from storage.objects s join public.minor_dossiers d on starts_with(s.name,d.id::text||'/') where d.figurant_id=p_id and s.bucket_id='minor-documents'
 union select q.bucket,q.path from public.rgpd_fichiers_a_effacer q where q.figurant_id=p_id;
$fn$;
revoke all on function public.rgpd_media_paths(uuid) from public,anon,authenticated;
grant execute on function public.rgpd_media_paths(uuid) to service_role;

create or replace function public.rgpd_subjects_from_row(p_row jsonb)
returns uuid[] language sql stable security invoker set search_path='' as $fn$
 select array_agg(distinct subject) from (
  select (p_row->>'figurant_id')::uuid as subject
  union select figurant_id from public.candidatures where id=(p_row->>'candidature_id')::uuid
  union select figurant_id from public.bookings where id=(p_row->>'booking_id')::uuid
  union select figurant_id from public.casting_entries where id=(p_row->>'casting_entry_id')::uuid or id=(p_row->>'entry_id')::uuid
  union select figurant_id from public.minor_dossiers where id=(p_row->>'dossier_id')::uuid
 ) subjects where subject is not null;
$fn$;
revoke all on function public.rgpd_subjects_from_row(jsonb) from public,anon,authenticated;
grant execute on function public.rgpd_subjects_from_row(jsonb) to service_role;

create or replace function public.rgpd_block_subject_write()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ids uuid[]; subject uuid; blocked boolean;
begin
 -- Le GUC role est le rôle de la transaction PostgREST. Un rôle ordinaire
 -- ne peut pas s'attribuer service_role, même dans un trigger definer.
 if current_setting('role',true)='service_role' and current_setting('booking.rgpd_cleanup',true)='1' then return new; end if;
 ids:=coalesce(public.rgpd_subjects_from_row(to_jsonb(new)),'{}'::uuid[]);
 if tg_op='UPDATE' then ids:=ids||coalesce(public.rgpd_subjects_from_row(to_jsonb(old)),'{}'::uuid[]); end if;
 for subject in select distinct value from unnest(ids) as candidates(value) where value is not null order by value loop
  select anonymise or anonymisation_en_cours_at is not null into blocked from public.figurants where id=subject for share;
  if not found or blocked then raise exception 'Profil indisponible pour cette écriture' using errcode='42501'; end if;
 end loop;
 return new;
end;
$fn$;
revoke all on function public.rgpd_block_subject_write() from public,anon,authenticated;

do $triggers$
declare target text;
begin
 foreach target in array array['figurant_photos','figurant_liens','figurant_indisponibilites','figurant_messages','figurant_sessions','figurant_auth_tokens','figurant_comptes','push_subscriptions','candidatures','candidature_reponses','casting_entries','casting_presentiel_entries','textos_file','partage_commentaires','lien_validation_votes','lien_validation_profils','casting_avis','reserve_profils','minor_guardians','minor_dossiers','minor_documents','minor_links'] loop
  execute format('create trigger rgpd_active_subject before insert or update on public.%I for each row execute function public.rgpd_block_subject_write()',target);
 end loop;
end $triggers$;
create trigger rgpd_booking_subject_insert before insert on public.bookings for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_booking_subject_update before update of figurant_id,notes,covoiturage_lieu_depart,covoiturage_conducteur_id on public.bookings for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_essayage_subject_insert before insert on public.essayages for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_essayage_subject_update before update of figurant_id,notes on public.essayages for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_notification_subject_insert before insert on public.notifications for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_notification_subject_update before update of figurant_id,titre,lien on public.notifications for each row execute function public.rgpd_block_subject_write();
create trigger rgpd_receipt_subject_insert before insert on public.envoi_destinataires for each row execute function public.rgpd_block_subject_write();

create trigger rgpd_receipt_subject_update before update of figurant_id,booking_id,erreur,token on public.envoi_destinataires for each row execute function public.rgpd_block_subject_write();

create or replace function public.rgpd_block_profile_change()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if tg_op='DELETE' then
  if old.anonymisation_en_cours_at is not null or exists(select 1 from public.rgpd_fichiers_a_effacer where figurant_id=old.id) then
   raise exception 'Effacement à terminer avant suppression du profil' using errcode='23503';
  end if;
  return old;
 end if;
 if current_setting('role',true)='service_role' and current_setting('booking.rgpd_cleanup',true)='1' then return new; end if;
 if old.anonymise or old.anonymisation_en_cours_at is not null then raise exception 'Profil indisponible pour cette écriture' using errcode='42501'; end if;
 return new;
end;
$fn$;
revoke all on function public.rgpd_block_profile_change() from public,anon,authenticated;
create trigger rgpd_profile_change before update or delete on public.figurants for each row execute function public.rgpd_block_profile_change();

create or replace function public.rgpd_block_storage_write()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare prefix text; subject uuid; blocked boolean;
begin
 if new.bucket_id not in ('figurant-photos','casting-videos','minor-documents') then return new; end if;
 prefix:=split_part(new.name,'/',1);
 if prefix!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Destination privée invalide' using errcode='42501'; end if;
 if new.bucket_id='minor-documents' then select figurant_id into subject from public.minor_dossiers where id=prefix::uuid; else subject:=prefix::uuid; end if;
 if subject is null then raise exception 'Destination privée indisponible' using errcode='42501'; end if;
 select anonymise or anonymisation_en_cours_at is not null into blocked from public.figurants where id=subject for share;
 if not found or blocked then raise exception 'Destination privée indisponible' using errcode='42501'; end if;
 return new;
end;
$fn$;
revoke all on function public.rgpd_block_storage_write() from public,anon,authenticated;
create trigger rgpd_storage_subject before insert or update of name,bucket_id on storage.objects for each row execute function public.rgpd_block_storage_write();

create or replace function public.preparer_effacement_figurant(p_id uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
begin
 if current_setting('role',true)<>'service_role' or not exists(select 1 from public.profiles where id=p_actor and is_owner and role='chef') then raise exception 'Effacement réservé au propriétaire' using errcode='42501'; end if;
 perform 1 from public.figurants where id=p_id for update;
 if not found then raise exception 'Profil introuvable' using errcode='P0002'; end if;
 perform pg_catalog.set_config('booking.rgpd_cleanup','1',true);
 insert into public.rgpd_fichiers_a_effacer(figurant_id,bucket,path,prepared_by)
 select p_id,m.bucket,m.path,p_actor from public.rgpd_media_paths(p_id) m where m.path is not null and length(m.path)>0
 on conflict(figurant_id,bucket,path) do nothing;
 if exists(select 1 from public.rgpd_fichiers_a_effacer q join public.figurant_photos f on q.bucket='figurant-photos' and f.storage_path=q.path where q.figurant_id=p_id and f.figurant_id<>p_id)
 or exists(select 1 from public.rgpd_fichiers_a_effacer q join public.casting_entries e on q.bucket='casting-videos' and q.path=any(e.video_storage_paths) where q.figurant_id=p_id and e.figurant_id<>p_id) then
  raise exception 'Un média est partagé avec un autre profil : vérifier le doublon avant effacement' using errcode='23503';
 end if;
 update public.figurants set anonymisation_en_cours_at=coalesce(anonymisation_en_cours_at,now()),acces_compte=false,
  civilite=null,prenom='Profil',nom='effacement en cours',email=null,telephone=null,adresse=null,code_postal=null,ville=null,commune_naissance=null,date_naissance=null,logement_france=null,
  notes_internes=null,tags='{}',agent_nom=null,agent_email=null,agent_telephone=null,agent_agence=null,vehicule_marque=null,token_disponibilite=gen_random_uuid()
 where id=p_id;
 delete from public.figurant_sessions where figurant_id=p_id;
 delete from public.figurant_auth_tokens where figurant_id=p_id;
 delete from public.figurant_comptes where figurant_id=p_id;
 delete from public.push_subscriptions where figurant_id=p_id;
 delete from public.figurant_messages where figurant_id=p_id or booking_id in(select id from public.bookings where figurant_id=p_id) or candidature_id in(select id from public.candidatures where figurant_id=p_id);
 delete from public.figurant_indisponibilites where figurant_id=p_id;
 delete from public.figurant_liens where figurant_id=p_id;
 delete from public.candidature_reponses where candidature_id in(select id from public.candidatures where figurant_id=p_id);
 delete from public.candidature_etiquette_liens where candidature_id in(select id from public.candidatures where figurant_id=p_id);
 delete from public.lien_validation_votes where figurant_id=p_id or candidature_id in(select id from public.candidatures where figurant_id=p_id);
 delete from public.lien_validation_profils where candidature_id in(select id from public.candidatures where figurant_id=p_id);
 delete from public.partage_commentaires where figurant_id=p_id or candidature_id in(select id from public.candidatures where figurant_id=p_id) or casting_entry_id in(select id from public.casting_entries where figurant_id=p_id);
 delete from public.casting_avis where entry_id in(select id from public.casting_entries where figurant_id=p_id);
 delete from public.reserve_profils where figurant_id=p_id;
 update public.candidatures set message=null,date_naissance=null where figurant_id=p_id;
 update public.bookings set notes=null,covoiturage_role=null,covoiturage_lieu_depart=null,covoiturage_places_disponibles=null,covoiturage_conducteur_id=null where figurant_id=p_id;
 update public.bookings set covoiturage_conducteur_id=null where covoiturage_conducteur_id=p_id;
 update public.essayages set notes=null where figurant_id=p_id;
 update public.casting_presentiel_entries set notes=null where figurant_id=p_id;
 update public.casting_entries set notes=null,reponses='{}'::jsonb,request_token=gen_random_uuid(),visible_partage=false,photo_vignette_id=null,video_storage_paths='{}',video_labels='{}' where figurant_id=p_id;
 update public.notifications set titre='Profil anonymisé',lien=null where figurant_id=p_id;
 update public.textos_file set telephone='',destinataire='Profil anonymisé',message='',erreur=null,statut=case when statut='envoye' then statut else 'annule' end where figurant_id=p_id;
 update public.envoi_destinataires set erreur=null,token=gen_random_uuid() where figurant_id=p_id or booking_id in(select id from public.bookings where figurant_id=p_id);
 update public.minor_links set revoked_at=now() where dossier_id in(select id from public.minor_dossiers where figurant_id=p_id);
 update public.minor_documents set storage_path=null,filename=null,mime_type=null,state='requested',valid_until=null,reviewed_at=null,reviewed_by=null,guardian_fingerprint=null,internal_note=null where dossier_id in(select id from public.minor_dossiers where figurant_id=p_id);
 delete from public.minor_guardians where figurant_id=p_id;
 delete from public.projet_photos_choisies where figurant_id=p_id;
 delete from public.figurant_photos where figurant_id=p_id;
 return jsonb_build_object('figurant_id',p_id,'files',coalesce((select jsonb_agg(jsonb_build_object('bucket',q.bucket,'path',q.path) order by q.bucket,q.path) from public.rgpd_fichiers_a_effacer q where q.figurant_id=p_id),'[]'::jsonb));
end;
$fn$;
revoke all on function public.preparer_effacement_figurant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preparer_effacement_figurant(uuid,uuid) to service_role;

create or replace function public.terminer_effacement_figurant(p_id uuid,p_actor uuid)
returns void language plpgsql security invoker set search_path='' as $fn$
begin
 if current_setting('role',true)<>'service_role' or not exists(select 1 from public.profiles where id=p_actor and is_owner and role='chef') then raise exception 'Effacement réservé au propriétaire' using errcode='42501'; end if;
 perform 1 from public.figurants where id=p_id and anonymisation_en_cours_at is not null for update;
 if not found then raise exception 'Aucun effacement en cours' using errcode='P0002'; end if;
 perform pg_catalog.set_config('booking.rgpd_cleanup','1',true);
 if exists(select 1 from public.rgpd_media_paths(p_id) m join storage.objects s on s.bucket_id=m.bucket and s.name=m.path) then raise exception 'Des fichiers restent présents : reprendre le nettoyage' using errcode='23514'; end if;
 delete from public.minor_dossiers where figurant_id=p_id;
 delete from public.rgpd_fichiers_a_effacer where figurant_id=p_id;
 update public.figurants set nom='anonymisé',anonymise=true,anonymise_le=coalesce(anonymise_le,now()),anonymisation_en_cours_at=null where id=p_id;
end;
$fn$;
revoke all on function public.terminer_effacement_figurant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.terminer_effacement_figurant(uuid,uuid) to service_role;
notify pgrst,'reload schema';
