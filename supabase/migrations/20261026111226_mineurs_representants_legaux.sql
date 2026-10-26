create table public.minor_guardians (
 figurant_id uuid not null references public.figurants(id) on delete cascade,
 position smallint not null check(position in (1,2)),
 prenom varchar(120), nom varchar(120), adresse varchar(1000), telephone varchar(64), email varchar(254),
 absence_reason text check(absence_reason in ('decede','sans_autorite')),
 updated_at timestamptz not null default now(),
 primary key(figurant_id,position),
 check (
  (absence_reason is not null and position=2 and prenom is null and nom is null and adresse is null and telephone is null and email is null)
  or (absence_reason is null and nullif(btrim(prenom),'') is not null and nullif(btrim(nom),'') is not null
   and nullif(btrim(adresse),'') is not null and nullif(btrim(telephone),'') is not null
   and email is not null and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 )
);
alter table public.minor_guardians enable row level security;
revoke all on table public.minor_guardians from public,anon,authenticated;
grant select,insert,update,delete on table public.minor_guardians to service_role;

create or replace function public.minor_guardians_complete(p_id uuid)
returns boolean language sql stable security invoker set search_path='' as $fn$
 select exists(
  select 1 from public.figurants f
  join public.minor_guardians a on a.figurant_id=f.id and a.position=1 and a.absence_reason is null
  join public.minor_guardians b on b.figurant_id=f.id and b.position=2
  where f.id=p_id and f.email is not null and lower(btrim(a.email))<>lower(btrim(f.email))
   and (b.absence_reason is not null or (lower(btrim(b.email))<>lower(btrim(f.email)) and lower(btrim(b.email))<>lower(btrim(a.email))))
 );
$fn$;
revoke all on function public.minor_guardians_complete(uuid) from public,anon,authenticated;
grant execute on function public.minor_guardians_complete(uuid) to service_role;

create or replace function public.save_minor_guardians(p_id uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path='' as $fn$
declare part jsonb; pos integer; child_email text; birth date; today date:=(now() at time zone 'Europe/Paris')::date;
begin
 select lower(btrim(email)),date_naissance into child_email,birth from public.figurants where id=p_id for update;
 if not found or child_email is null or birth is null or birth>today or birth<=today-interval '18 years' then raise exception 'Profil mineur invalide'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'first') is distinct from 'object' or jsonb_typeof(p_data->'second') is distinct from 'object' then raise exception 'Deux représentants sont requis'; end if;
 delete from public.minor_guardians where figurant_id=p_id;
 for pos in 1..2 loop
  part:=p_data->case when pos=1 then 'first' else 'second' end;
  if pos=2 and nullif(part->>'absence_reason','') is not null then
   insert into public.minor_guardians(figurant_id,position,absence_reason) values(p_id,pos,part->>'absence_reason');
  else
   insert into public.minor_guardians(figurant_id,position,prenom,nom,adresse,telephone,email)
   values(p_id,pos,btrim(part->>'prenom'),btrim(part->>'nom'),btrim(part->>'adresse'),btrim(part->>'telephone'),lower(btrim(part->>'email')));
  end if;
 end loop;
 if not public.minor_guardians_complete(p_id) then raise exception 'Trois adresses email distinctes sont requises'; end if;
end $fn$;
revoke all on function public.save_minor_guardians(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_minor_guardians(uuid,jsonb) to service_role;

-- Seul le trigger lit les contacts confidentiels au nom d'une écriture autorisée.
-- Il n'est pas une RPC publique et ne renvoie aucune donnée personnelle.
create or replace function public.enforce_minor_representatives()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare birth date; today date:=(now() at time zone 'Europe/Paris')::date;
begin
 if tg_table_name='figurant_comptes' and exists(select 1 from public.figurant_comptes where figurant_id=new.figurant_id) then return new; end if;
 select date_naissance into birth from public.figurants where id=new.figurant_id;
 if birth is null or birth>today then raise exception 'La date de naissance est obligatoire'; end if;
 if birth>today-interval '18 years' and not public.minor_guardians_complete(new.figurant_id) then
  raise exception 'Les informations des représentants légaux sont obligatoires';
 end if;
 if tg_table_name='candidatures' and not exists(select 1 from public.figurant_comptes where figurant_id=new.figurant_id) then
  raise exception 'Un compte est obligatoire pour postuler';
 end if;
 return new;
end $fn$;
revoke all on function public.enforce_minor_representatives() from public,anon,authenticated;
create trigger minor_account_representatives before insert on public.figurant_comptes for each row execute function public.enforce_minor_representatives();
create trigger minor_application_representatives before insert or update of figurant_id on public.candidatures for each row execute function public.enforce_minor_representatives();

-- Activation d'un profil ajouté rapidement : naissance et représentants sont
-- enregistrés sous le même verrou que le mot de passe et la consommation du lien.
drop function if exists public.activer_compte_invitation(text,text);
create or replace function public.activer_compte_invitation(p_token text,p_password_hash text,p_birth date default null,p_guardians jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare invitation public.figurant_auth_tokens%rowtype; birth date; today date:=(now() at time zone 'Europe/Paris')::date;
begin
 if p_token is null or p_password_hash is null or p_token !~ '^[0-9a-f]{32}$' or p_password_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$' then raise exception 'Invitation invalide'; end if;
 select * into invitation from public.figurant_auth_tokens where token=p_token and objet='creation_compte';
 if not found then raise exception 'Invitation invalide'; end if;
 select date_naissance into birth from public.figurants where id=invitation.figurant_id for update;
 select * into invitation from public.figurant_auth_tokens where token=p_token and objet='creation_compte' for update;
 if not found or invitation.used_at is not null or invitation.expires_at<=now() then raise exception 'Invitation invalide'; end if;
 if exists(select 1 from public.figurant_comptes where figurant_id=invitation.figurant_id) then raise exception 'Compte déjà créé'; end if;
 birth:=coalesce(birth,p_birth);
 if birth is null or birth>today then raise exception 'Date de naissance requise'; end if;
 update public.figurants set date_naissance=birth where id=invitation.figurant_id;
 if birth>today-interval '18 years' then perform public.save_minor_guardians(invitation.figurant_id,p_guardians); end if;
 insert into public.figurant_comptes(figurant_id,password_hash) values(invitation.figurant_id,p_password_hash);
 update public.figurants set acces_compte=true where id=invitation.figurant_id;
 update public.figurant_auth_tokens set used_at=now() where figurant_id=invitation.figurant_id and objet='creation_compte' and used_at is null;
 return invitation.figurant_id;
end $fn$;
revoke all on function public.activer_compte_invitation(text,text,date,jsonb) from public,anon,authenticated;
grant execute on function public.activer_compte_invitation(text,text,date,jsonb) to service_role;
notify pgrst,'reload schema';
