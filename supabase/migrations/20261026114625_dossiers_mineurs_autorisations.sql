create table public.minor_dossiers (
 id uuid primary key default gen_random_uuid(),
 projet_id uuid not null references public.projets(id) on delete cascade,
 figurant_id uuid not null references public.figurants(id) on delete cascade,
 tournage_debut date, tournage_fin date, commission_date date,
 role_label varchar(200), cachet_info varchar(400),
 created_at timestamptz not null default now(),
 unique(projet_id,figurant_id),
 check(tournage_fin is null or tournage_debut is null or tournage_fin>=tournage_debut)
);
create index minor_dossiers_child on public.minor_dossiers(figurant_id);
create table public.minor_requirements (
 id uuid primary key default gen_random_uuid(),
 projet_id uuid not null references public.projets(id) on delete cascade,
 label varchar(200) not null check(length(btrim(label))>0),
 required boolean not null default true, active boolean not null default true,
 created_at timestamptz not null default now()
);
create index minor_requirements_project on public.minor_requirements(projet_id);
create table public.minor_documents (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references public.minor_dossiers(id) on delete cascade,
 source_key text not null check(source_key ~ '^(guardian_[12]|extra_[0-9a-f-]{36})$'),
 state text not null default 'received' check(state in ('requested','received','validated','refused')),
 storage_path text unique, filename varchar(200), mime_type text check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 valid_until date, internal_note varchar(2000), reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete set null,
 guardian_fingerprint text,
 updated_at timestamptz not null default now(),
 unique(dossier_id,source_key),
 constraint minor_documents_validated_file check(state<>'validated' or (storage_path is not null and reviewed_at is not null))
);
create index minor_documents_reviewer on public.minor_documents(reviewed_by);
create table public.minor_links (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references public.minor_dossiers(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 kind text not null check(kind in ('guardian_1','guardian_2','production')),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz, upload_count integer not null default 0 check(upload_count between 0 and 30),
 created_at timestamptz not null default now(),
 check(expires_at>created_at and expires_at<=created_at+interval '7 days')
);
create index minor_links_dossier on public.minor_links(dossier_id);
alter table public.minor_dossiers enable row level security;
alter table public.minor_requirements enable row level security;
alter table public.minor_documents enable row level security;
alter table public.minor_links enable row level security;
revoke all on table public.minor_dossiers,public.minor_requirements,public.minor_documents,public.minor_links from public,anon,authenticated;
grant select,insert,update,delete on table public.minor_dossiers,public.minor_requirements,public.minor_documents,public.minor_links to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('minor-documents','minor-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "minor documents server only" on storage.objects as restrictive
for all to anon,authenticated using(bucket_id<>'minor-documents') with check(bucket_id<>'minor-documents');
-- Aucune policy permissive de lecture/écriture publique : fichiers accessibles uniquement
-- après contrôle serveur et URL signée de courte durée.

create or replace function public.minor_guardian_fingerprint(p_id uuid,p_position integer)
returns text language sql stable security invoker set search_path='' as $fn$
 select md5((to_jsonb(g)-'updated_at'-'figurant_id')::text) from public.minor_guardians g where figurant_id=p_id and position=p_position;
$fn$;
revoke all on function public.minor_guardian_fingerprint(uuid,integer) from public,anon,authenticated;
grant execute on function public.minor_guardian_fingerprint(uuid,integer) to service_role;

create or replace function public.minor_dossier_complete(p_project uuid,p_child uuid,p_date date)
returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare birth date; dossier public.minor_dossiers; v_position smallint; document public.minor_documents; key text;
begin
 select date_naissance into birth from public.figurants where id=p_child;
 if birth is null or birth>p_date then return false; end if;
 if birth<=p_date-interval '18 years' then return true; end if;
 if not public.minor_guardians_complete(p_child) then return false; end if;
 select * into dossier from public.minor_dossiers where projet_id=p_project and figurant_id=p_child;
 if not found then return false; end if;
 if birth>p_date-interval '16 years' and (dossier.commission_date is null or dossier.tournage_debut is null or dossier.tournage_fin is null or p_date not between dossier.tournage_debut and dossier.tournage_fin) then return false; end if;
 for v_position in 1..2 loop
  if v_position=2 and exists(select 1 from public.minor_guardians where figurant_id=p_child and position=2 and absence_reason is not null) then continue; end if;
  select * into document from public.minor_documents where dossier_id=dossier.id and source_key='guardian_'||v_position;
  if not found or document.state<>'validated' or document.storage_path is null or not exists(select 1 from storage.objects where bucket_id='minor-documents' and name=document.storage_path) or (document.valid_until is not null and document.valid_until<p_date)
    or document.guardian_fingerprint is distinct from public.minor_guardian_fingerprint(p_child,v_position) then return false; end if;
 end loop;
 if birth>p_date-interval '16 years' then
 for key in select 'extra_'||id from public.minor_requirements where projet_id=p_project and active and required loop
  select * into document from public.minor_documents where dossier_id=dossier.id and source_key=key;
  if not found or document.state<>'validated' or document.storage_path is null or not exists(select 1 from storage.objects where bucket_id='minor-documents' and name=document.storage_path) or (document.valid_until is not null and document.valid_until<p_date) then return false; end if;
 end loop;
 end if;
 return true;
end;
$fn$;
revoke all on function public.minor_dossier_complete(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.minor_dossier_complete(uuid,uuid,date) to service_role;

create or replace function public.review_minor_document(p_document uuid,p_state text,p_until date,p_actor uuid,p_note text default null,p_expected_path text default null,p_expected_guardian text default null)
returns void language plpgsql security invoker set search_path='' as $fn$
declare document public.minor_documents; dossier public.minor_dossiers; pos smallint; fingerprint text;
begin
 if p_actor is null or length(p_note)>2000 then raise exception 'Auteur ou commentaire invalide'; end if;
 if p_state not in ('validated','refused','received') then raise exception 'Statut invalide'; end if;
 select * into document from public.minor_documents where id=p_document for update;
 if not found then raise exception 'Document introuvable'; end if;
 if p_expected_path is null or p_expected_path is distinct from document.storage_path then raise exception 'Le fichier a changé : recharger et vérifier sa nouvelle version'; end if;
 select * into dossier from public.minor_dossiers where id=document.dossier_id;
 if p_state='validated' and (document.storage_path is null or not exists(select 1 from storage.objects where bucket_id='minor-documents' and name=document.storage_path)) then raise exception 'Fichier obligatoire'; end if;
 pos:=case document.source_key when 'guardian_1' then 1 when 'guardian_2' then 2 else null end;
 fingerprint:=case when pos is null then null else public.minor_guardian_fingerprint(dossier.figurant_id,pos) end;
 if p_state='validated' and pos is not null and (p_expected_guardian is null or p_expected_guardian is distinct from fingerprint) then raise exception 'Les représentants ont changé : recharger et vérifier les coordonnées actuelles'; end if;
 update public.minor_documents set state=p_state,valid_until=p_until,internal_note=nullif(btrim(p_note),''),reviewed_at=now(),reviewed_by=p_actor,
  guardian_fingerprint=fingerprint,updated_at=now()
 where id=p_document;
end;
$fn$;
revoke all on function public.review_minor_document(uuid,text,date,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_minor_document(uuid,text,date,uuid,text,text,text) to service_role;

create or replace function public.consume_minor_upload(p_hash text,p_key text)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare link public.minor_links; project uuid; needs_drieets boolean;
begin
 select * into link from public.minor_links where token_hash=p_hash for update;
 if not found or link.revoked_at is not null or link.expires_at<=now() or link.kind='production' or link.upload_count>=30 then return null; end if;
 select d.projet_id,f.date_naissance>coalesce(d.tournage_debut,(now() at time zone 'Europe/Paris')::date)-interval '16 years' into project,needs_drieets from public.minor_dossiers d join public.figurants f on f.id=d.figurant_id where d.id=link.dossier_id;
 if p_key<>link.kind and (not coalesce(needs_drieets,false) or not exists(select 1 from public.minor_requirements where projet_id=project and active and 'extra_'||id=p_key)) then return null; end if;
 update public.minor_links set upload_count=upload_count+1 where id=link.id;
 return link.dossier_id;
end;
$fn$;
revoke all on function public.consume_minor_upload(text,text) from public,anon,authenticated;
grant execute on function public.consume_minor_upload(text,text) to service_role;

create or replace function public.enforce_minor_booking()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare birth date;
begin
 if new.statut='annulé' then return new; end if;
 select date_naissance into birth from public.figurants where id=new.figurant_id;
 if birth is not null and birth>new.date-interval '18 years' and not public.minor_dossier_complete(new.projet_id,new.figurant_id,new.date) then
  raise exception 'Dossier mineur incomplet : représentants, autorisations validées et pièces requises avant booking' using errcode='23514';
 end if;
 return new;
end;
$fn$;
revoke all on function public.enforce_minor_booking() from public,anon,authenticated;
create trigger minor_booking_complete before insert or update of figurant_id,projet_id,date,statut on public.bookings for each row execute function public.enforce_minor_booking();
notify pgrst,'reload schema';

create or replace function public.commit_minor_upload(p_hash text,p_key text,p_path text,p_filename text,p_mime text)
returns text language plpgsql security invoker set search_path='' as $fn$
declare link public.minor_links; project uuid; needs_drieets boolean; old_path text;
begin
 select * into link from public.minor_links where token_hash=p_hash for update;
 if not found or link.revoked_at is not null or link.expires_at<=now() or link.kind='production' or link.upload_count=0 then raise exception 'Lien invalide ou expiré'; end if;
 select d.projet_id,f.date_naissance>coalesce(d.tournage_debut,(now() at time zone 'Europe/Paris')::date)-interval '16 years' into project,needs_drieets from public.minor_dossiers d join public.figurants f on f.id=d.figurant_id where d.id=link.dossier_id;
 if p_key<>link.kind and (not coalesce(needs_drieets,false) or not exists(select 1 from public.minor_requirements where projet_id=project and active and 'extra_'||id=p_key)) then raise exception 'Pièce non autorisée'; end if;
 if p_path not like link.dossier_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='minor-documents' and name=p_path) then raise exception 'Fichier introuvable'; end if;
 select storage_path into old_path from public.minor_documents where dossier_id=link.dossier_id and source_key=p_key for update;
 insert into public.minor_documents(dossier_id,source_key,storage_path,filename,mime_type,state)
 values(link.dossier_id,p_key,p_path,p_filename,p_mime,'received')
 on conflict(dossier_id,source_key) do update set storage_path=excluded.storage_path,filename=excluded.filename,mime_type=excluded.mime_type,state='received',valid_until=null,internal_note=null,reviewed_at=null,reviewed_by=null,guardian_fingerprint=null,updated_at=now();
 return old_path;
end;
$fn$;
revoke all on function public.commit_minor_upload(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.commit_minor_upload(text,text,text,text,text) to service_role;
notify pgrst,'reload schema';

create or replace function public.protect_minor_dossier_files()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if exists(select 1 from storage.objects where bucket_id='minor-documents' and starts_with(name,old.id::text||'/')) then
  raise exception 'Les pièces mineurs doivent être purgées avant suppression du dossier ou du projet' using errcode='23514';
 end if;
 return old;
end;
$fn$;
revoke all on function public.protect_minor_dossier_files() from public,anon,authenticated;
create trigger minor_dossier_files_before_delete before delete on public.minor_dossiers for each row execute function public.protect_minor_dossier_files();

create or replace function public.enforce_minor_convocation()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare booking public.bookings; birth date;
begin
 if new.sender<>'staff' or new.categorie is distinct from 'convocation' or new.booking_id is null then return new; end if;
 select * into booking from public.bookings where id=new.booking_id;
 if not found or booking.figurant_id<>new.figurant_id or new.projet_id is distinct from booking.projet_id then raise exception 'Booking incompatible avec le message' using errcode='23514'; end if;
 select date_naissance into birth from public.figurants where id=booking.figurant_id;
 if birth is not null and birth>booking.date-interval '18 years' and not public.minor_dossier_complete(booking.projet_id,booking.figurant_id,booking.date) then
  raise exception 'Dossier mineur incomplet : convocation refusée' using errcode='23514';
 end if;
 return new;
end;
$fn$;
revoke all on function public.enforce_minor_convocation() from public,anon,authenticated;
create trigger minor_convocation_complete before insert or update of booking_id,figurant_id,projet_id,categorie on public.figurant_messages for each row execute function public.enforce_minor_convocation();
notify pgrst,'reload schema';
