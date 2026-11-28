create or replace function public.activer_compte_invitation(p_token text, p_password_hash text)
returns uuid
language plpgsql security invoker set search_path = ''
as $function$
declare invitation public.figurant_auth_tokens%rowtype;
begin
  if p_token is null or p_password_hash is null or p_token !~ '^[0-9a-f]{32}$' or p_password_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$' then
    raise exception 'Invitation invalide';
  end if;
  select * into invitation from public.figurant_auth_tokens
    where token=p_token and objet='creation_compte' for update;
  if not found or invitation.used_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation invalide';
  end if;
  -- Deux invitations différentes pour la même fiche doivent aussi se sérialiser.
  perform 1 from public.figurants where id=invitation.figurant_id for update;
  if exists (select 1 from public.figurant_comptes where figurant_id=invitation.figurant_id) then
    raise exception 'Compte déjà créé';
  end if;
  insert into public.figurant_comptes(figurant_id,password_hash) values(invitation.figurant_id,p_password_hash);
  update public.figurants set acces_compte=true where id=invitation.figurant_id;
  update public.figurant_auth_tokens set used_at=now()
    where figurant_id=invitation.figurant_id and objet='creation_compte' and used_at is null;
  return invitation.figurant_id;
end $function$;
revoke all on function public.activer_compte_invitation(text,text) from public,anon,authenticated;
grant execute on function public.activer_compte_invitation(text,text) to service_role;
