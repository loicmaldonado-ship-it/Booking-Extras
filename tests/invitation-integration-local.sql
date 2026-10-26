do $test$
declare result uuid; n integer; expected_hash text := repeat('a',32)||':'||repeat('b',128);
begin
 begin
  assert not has_function_privilege('anon','public.activer_compte_invitation(text,text)','execute'),'RPC ouverte au public';
  assert not has_function_privilege('authenticated','public.activer_compte_invitation(text,text)','execute'),'RPC ouverte au staff direct';
  insert into public.figurants(id,prenom,nom,acces_compte) values('00000000-0000-4000-8000-00000000b100','Invitation','Test',false);
  insert into public.figurant_auth_tokens(figurant_id,token,objet,expires_at) values
    ('00000000-0000-4000-8000-00000000b100',repeat('c',32),'creation_compte',now()+interval '1 hour'),
    ('00000000-0000-4000-8000-00000000b100',repeat('d',32),'creation_compte',now()+interval '1 hour');
  set local role service_role;
  result := public.activer_compte_invitation(repeat('c',32),expected_hash);
  assert result='00000000-0000-4000-8000-00000000b100'::uuid,'Mauvais compte activé';
  assert (select acces_compte from public.figurants where id=result),'Accès non activé';
  assert (select password_hash=expected_hash from public.figurant_comptes where figurant_id=result),'Hash non enregistré';
  select count(*) into n from public.figurant_auth_tokens where figurant_id=result and used_at is null;
  assert n=0,'Autre invitation encore active';
  begin
    perform public.activer_compte_invitation(repeat('d',32),repeat('e',32)||':'||repeat('f',128));
    raise exception using errcode='ZX002',message='Réutilisation autorisée';
  exception when raise_exception then null;
  end;
  assert (select password_hash=expected_hash from public.figurant_comptes where figurant_id=result),'Mot de passe écrasé';
  reset role;
  raise exception using errcode='ZX001',message='Annuler fixtures';
 exception when sqlstate 'ZX001' then raise notice 'PASS activation atomique, accès, consommation de tous les liens et refus réutilisation; fixtures annulées';
 end;
end $test$;
