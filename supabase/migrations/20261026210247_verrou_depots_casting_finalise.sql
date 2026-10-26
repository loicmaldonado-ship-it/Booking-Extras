-- Les chemins publics comportent entrée + numéro/label ; les chemins équipe
-- restent distincts et conservent leur fonctionnement après transmission.
create function public.enforce_public_casting_storage_state()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare entry_text text; candidate_text text; casting public.casting_entries; deadline date;
 uuid_pattern constant text:='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
 if new.bucket_id='casting-videos' then
  entry_text:=substring(new.name from ('(?i)^'||uuid_pattern||'/('||uuid_pattern||')-video-[0-9]+-'||uuid_pattern||'\.mp4$'));
 elsif new.bucket_id='figurant-photos' then
  entry_text:=substring(new.name from ('(?i)^'||uuid_pattern||'/casting-('||uuid_pattern||')-.*-'||uuid_pattern||'\.jpg$'));
 else return new;
 end if;
 if entry_text is null then return new; end if;
 candidate_text:=split_part(new.name,'/',1);
 select * into casting from public.casting_entries where id=entry_text::uuid and figurant_id=candidate_text::uuid for share;
 if not found or casting.submitted_at is not null or casting.statut in ('attente_validation','valide','confirmé','indisponible','annulé') then
  raise exception 'Dépôt de casting fermé : recharge le lien' using errcode='42501';
 end if;
 select date_limite_envoi into deadline from public.casting_roles where id=casting.role_id for share;
 if deadline is not null and deadline<(now() at time zone 'UTC')::date then
  raise exception 'Date limite du dépôt dépassée' using errcode='42501';
 end if;
 return new;
end $fn$;
revoke all on function public.enforce_public_casting_storage_state() from public,anon,authenticated;
-- Après rgpd_storage_subject : même ordre de verrouillage profil puis entrée.
create trigger zz_public_casting_storage_state before insert or update on storage.objects
for each row execute function public.enforce_public_casting_storage_state();
