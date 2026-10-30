-- SEC-03 / SEC-04 : audit d'isolation entre deux équipes fictives, au niveau base (RLS + GRANT).
-- Usage (base LOCALE uniquement, aucune donnée conservée : tout est annulé en fin de script) :
--   docker exec -i supabase_db_BOOKING_EXTRAS psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/cross-team-isolation-local.sql
-- Pour chaque acteur (cheffe et assistante de chaque équipe) et chaque ligne de l'autre équipe,
-- tente SELECT / UPDATE / DELETE avec un JWT authenticated. Toute ligne étrangère lisible ou
-- modifiable est signalée ; le script échoue si une fuite est détectée sur une table de projet.
begin;
create temp table fx(tbl text, team int, key_col text, key_val uuid) on commit drop;
create temp table res(actor text, tbl text, own_visible int, foreign_visible int, foreign_updated int, foreign_deleted int) on commit drop;
grant all on fx, res to authenticated;

do $fixture$
declare
  t int; chef uuid; asst uuid; prj uuid; fig uuid; ann uuid; ad uuid; aq uuid; cand uuid; etq uuid; jr uuid; cr uuid; ce uuid; cpj uuid; cpc uuid; ej uuid; x uuid;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  for t in 1..2 loop
    chef:=gen_random_uuid(); asst:=gen_random_uuid(); prj:=gen_random_uuid(); fig:=gen_random_uuid();
    insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data) values
      (chef,'iso-chef-'||t||'-'||chef||'@example.test','authenticated','authenticated','{}','{}'),
      (asst,'iso-asst-'||t||'-'||asst||'@example.test','authenticated','authenticated','{}','{}');
    update public.profiles set role='chef',is_owner=false where id=chef;
    update public.profiles set role='assistant',is_owner=false where id=asst;
    insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),chef,now()),(gen_random_uuid(),asst,now());
    insert into fx values('actor:chef',t,'id',chef),('actor:asst',t,'id',asst);
    insert into fx values('profiles',t,'id',chef),('profiles',t,'id',asst);

    insert into public.projets(id,nom,owner_id) values(prj,'Isolation fictif '||t,chef); insert into fx values('projets',t,'id',prj);
    x:=gen_random_uuid(); insert into public.projet_membres(id,projet_id,profile_id) values(x,prj,asst); insert into fx values('projet_membres',t,'id',x);
    insert into public.figurants(id,prenom,nom,date_naissance,temporaire_projet_id,acces_compte) values(fig,'Iso','Fictif '||t,'1990-01-01',prj,false); insert into fx values('figurants',t,'id',fig);
    insert into public.figurant_comptes(figurant_id,password_hash) values(fig,'iso-fictif-non-utilisable');
    x:=gen_random_uuid(); insert into public.figurant_photos(id,figurant_id,type,storage_path,projet_id) values(x,fig,'portrait','iso/'||x||'.jpg',prj); insert into fx values('figurant_photos',t,'id',x);
    x:=gen_random_uuid(); insert into public.figurant_liens(id,figurant_id,label,url) values(x,fig,'Iso','https://example.test/'||t); insert into fx values('figurant_liens',t,'id',x);

    ann:=gen_random_uuid(); insert into public.annonces(id,projet_id,titre) values(ann,prj,'Annonce iso '||t); insert into fx values('annonces',t,'id',ann);
    ad:=gen_random_uuid(); insert into public.annonce_dates(id,annonce_id,date) values(ad,ann,current_date+30); insert into fx values('annonce_dates',t,'id',ad);
    aq:=gen_random_uuid(); insert into public.annonce_questions(id,annonce_id,label) values(aq,ann,'Question iso'); insert into fx values('annonce_questions',t,'id',aq);
    x:=gen_random_uuid(); insert into public.annonce_photos(id,annonce_id,storage_path) values(x,ann,'iso/'||x||'.jpg'); insert into fx values('annonce_photos',t,'id',x);

    cand:=gen_random_uuid(); insert into public.candidatures(id,figurant_id,annonce_id) values(cand,fig,ann); insert into fx values('candidatures',t,'id',cand);
    insert into public.candidature_jours(candidature_id,annonce_date_id) values(cand,ad); insert into fx values('candidature_jours',t,'candidature_id',cand);
    x:=gen_random_uuid(); insert into public.candidature_disponibilites(id,candidature_id,annonce_date_id,disponible) values(x,cand,ad,true); insert into fx values('candidature_disponibilites',t,'id',x);
    x:=gen_random_uuid(); insert into public.candidature_reponses(id,candidature_id,annonce_question_id,reponse) values(x,cand,aq,true); insert into fx values('candidature_reponses',t,'id',x);
    etq:=gen_random_uuid(); insert into public.candidature_etiquettes(id,projet_id,nom) values(etq,prj,'Etiquette iso'); insert into fx values('candidature_etiquettes',t,'id',etq);
    insert into public.candidature_etiquette_liens(candidature_id,etiquette_id) values(cand,etq); insert into fx values('candidature_etiquette_liens',t,'candidature_id',cand);

    jr:=gen_random_uuid(); insert into public.journees(id,projet_id,date) values(jr,prj,current_date+30); insert into fx values('journees',t,'id',jr);
    x:=gen_random_uuid(); insert into public.journee_besoins(id,journee_id,fonction,quantite) values(x,jr,'Figuration',2); insert into fx values('journee_besoins',t,'id',x);
    x:=gen_random_uuid(); insert into public.bookings(id,figurant_id,projet_id,date) values(x,fig,prj,current_date+30); insert into fx values('bookings',t,'id',x);
    x:=gen_random_uuid(); insert into public.reserve_profils(id,projet_id,figurant_id) values(x,prj,fig); insert into fx values('reserve_profils',t,'id',x);

    cr:=gen_random_uuid(); insert into public.casting_roles(id,projet_id,nom) values(cr,prj,'Role iso'); insert into fx values('casting_roles',t,'id',cr);
    ce:=gen_random_uuid(); insert into public.casting_entries(id,projet_id,figurant_id,role_id) values(ce,prj,fig,cr); insert into fx values('casting_entries',t,'id',ce);
    x:=gen_random_uuid(); insert into public.casting_upload_events(id,entry_id,projet_id,source,kind,outcome) values(x,ce,prj,'equipe','photo','reussi'); insert into fx values('casting_upload_events',t,'id',x);
    cpj:=gen_random_uuid(); insert into public.casting_presentiel_journees(id,projet_id,date) values(cpj,prj,current_date+20); insert into fx values('casting_presentiel_journees',t,'id',cpj);
    cpc:=gen_random_uuid(); insert into public.casting_presentiel_creneaux(id,journee_id,heure_debut,heure_fin) values(cpc,cpj,'10:00','11:00'); insert into fx values('casting_presentiel_creneaux',t,'id',cpc);
    x:=gen_random_uuid(); insert into public.casting_presentiel_entries(id,projet_id,journee_id,creneau_id,figurant_id) values(x,prj,cpj,cpc,fig); insert into fx values('casting_presentiel_entries',t,'id',x);

    ej:=gen_random_uuid(); insert into public.essayage_journees(id,projet_id,date) values(ej,prj,current_date+25); insert into fx values('essayage_journees',t,'id',ej);
    x:=gen_random_uuid(); insert into public.essayages(id,figurant_id,projet_id,essayage_journee_id) values(x,fig,prj,ej); insert into fx values('essayages',t,'id',x);

    x:=gen_random_uuid(); insert into public.partage_liens(id,projet_id,type,token) values(x,prj,'documents','iso-'||x); insert into fx values('partage_liens',t,'id',x);
    x:=gen_random_uuid(); insert into public.partage_journee_liens(id,projet_id,date,token) values(x,prj,current_date+30,'iso-'||x); insert into fx values('partage_journee_liens',t,'id',x);
  end loop;
end $fixture$;

do $audit$
declare
  a record; f record; sid uuid; own int; vis int; upd int; del int; n int; tables text[];
begin
  select array_agg(distinct tbl order by tbl) into tables from fx where tbl not like 'actor:%';
  for a in select tbl as kind, team, key_val as uid from fx where tbl like 'actor:%' order by team, tbl loop
    select id into sid from auth.sessions where user_id=a.uid limit 1;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',a.uid,'role','authenticated','session_id',sid)::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    for f in select unnest(tables) as tbl loop
      own:=0; vis:=0; upd:=0; del:=0;
      for n in select 1 from fx where tbl=f.tbl loop end loop;
      set local role authenticated;
      -- lignes de sa propre équipe
      execute format('select count(*) from public.%I where %I in (select key_val from fx where tbl=%L and team=%s)',
        f.tbl,(select key_col from fx where tbl=f.tbl limit 1),f.tbl,a.team) into own;
      -- lignes de l'autre équipe
      execute format('select count(*) from public.%I where %I in (select key_val from fx where tbl=%L and team<>%s)',
        f.tbl,(select key_col from fx where tbl=f.tbl limit 1),f.tbl,a.team) into vis;
      begin
        execute format('update public.%I set %I=%I where %I in (select key_val from fx where tbl=%L and team<>%s)',
          f.tbl,(select key_col from fx where tbl=f.tbl limit 1),(select key_col from fx where tbl=f.tbl limit 1),(select key_col from fx where tbl=f.tbl limit 1),f.tbl,a.team);
        get diagnostics upd=row_count;
        raise exception using errcode='ZX999';
      exception when sqlstate 'ZX999' then null; when insufficient_privilege then upd:=0; when others then upd:=-1;
      end;
      begin
        execute format('delete from public.%I where %I in (select key_val from fx where tbl=%L and team<>%s)',
          f.tbl,(select key_col from fx where tbl=f.tbl limit 1),f.tbl,a.team);
        get diagnostics del=row_count;
        raise exception using errcode='ZX999';
      exception when sqlstate 'ZX999' then null; when insufficient_privilege then del:=0; when others then del:=-1;
      end;
      reset role;
      insert into res values(replace(a.kind,'actor:','')||a.team,f.tbl,own,vis,upd,del);
    end loop;
  end loop;
end $audit$;

\echo '--- Lignes de l''AUTRE équipe accessibles (vide = isolation correcte) ---'
select tbl, string_agg(actor||' lit='||foreign_visible||' maj='||foreign_updated||' suppr='||foreign_deleted, '  ' order by actor) as acces_etranger
from res where foreign_visible>0 or foreign_updated<>0 or foreign_deleted<>0 group by tbl order by tbl;
\echo '--- Contrôle : lignes de SA PROPRE équipe invisibles (accès légitime cassé ?) ---'
select tbl, string_agg(actor, ',' order by actor) as acteurs_sans_acces from res where own_visible=0 group by tbl order by tbl;
-- profiles : lecture des noms/emails du personnel de toutes les équipes conservée volontairement
-- (hotfix 423751b, test « Team names hidden ») en attendant la décision DEC-02 ; écriture/suppression interdites.
do $verdict$
declare leaks text; broken text;
begin
  select string_agg(distinct tbl, ', ') into leaks from res
   where (foreign_visible>0 and tbl<>'profiles') or foreign_updated<>0 or foreign_deleted<>0;
  select string_agg(distinct tbl, ', ') into broken from res where own_visible=0;
  if leaks is not null then raise exception 'ÉCHEC isolation inter-équipes : %', leaks; end if;
  if broken is not null then raise exception 'ÉCHEC accès légitime perdu : %', broken; end if;
  raise notice 'PASS: % tables, 4 acteurs, aucune ligne étrangère lisible/modifiable/supprimable (hors lecture profiles documentée)', (select count(distinct tbl) from res);
end $verdict$;
rollback;
