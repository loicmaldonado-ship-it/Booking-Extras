-- Limite de débit des parcours publics (inscription, candidature, casting sans compte) : 100/h par connexion, 8/h par email.
do $test$
declare i integer;
begin begin
 delete from public.limites_publiques;
 for i in 1..8 loop assert public.consommer_limite_publique(repeat('1',64),repeat('2',64)),'Demande autorisée refusée'; end loop;
 assert not public.consommer_limite_publique(repeat('1',64),repeat('2',64)),'Neuvième demande pour le même email autorisée';
 assert not public.consommer_limite_publique(repeat('9',64),repeat('2',64)),'Changer de connexion contourne la limite email';
 update public.limites_publiques set period_started_at=now()-interval '61 minutes';
 assert public.consommer_limite_publique(repeat('1',64),repeat('2',64)),'Fenêtre expirée non réouverte';
 delete from public.limites_publiques;
 for i in 1..100 loop
  assert public.consommer_limite_publique(repeat('a',64),lpad(to_hex(i),64,'0')),'Limite réseau prématurée';
 end loop;
 assert not public.consommer_limite_publique(repeat('a',64),repeat('b',64)),'Rotation des emails contourne la limite réseau';
 assert not public.consommer_limite_publique(null,repeat('b',64)),'Clé nulle acceptée';
 assert not public.consommer_limite_publique('pas-un-hash',repeat('b',64)),'Clé invalide acceptée';
 assert not public.consommer_limite_publique(repeat('c',64),repeat('c',64)),'Clés identiques acceptées';
 assert not has_function_privilege('anon','public.consommer_limite_publique(text,text)','execute'),'Fonction appelable anonymement';
 assert not has_function_privilege('authenticated','public.consommer_limite_publique(text,text)','execute'),'Fonction appelable par une session';
 assert not has_table_privilege('anon','public.limites_publiques','select'),'Table lisible anonymement';
 raise exception using errcode='ZX001',message='Rollback fixtures';
exception when sqlstate 'ZX001' then raise notice 'PASS limites publiques : email, réseau, fenêtre, clés invalides, droits';
end; end $test$;
