-- Sérialiser une nouvelle session/connexion avec la révocation du profil.
-- SECURITY DEFINER lit le seul profil porté par la ligne ; aucun appel public.
create function public.enforce_candidate_access_for_credentials()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare enabled boolean;
begin
 if tg_table_name='figurant_auth_tokens' then
  if new.objet<>'connexion' then return new; end if;
 end if;
 select acces_compte and not anonymise and anonymisation_en_cours_at is null into enabled
 from public.figurants where id=new.figurant_id for share;
 if not found or not enabled then raise exception 'Accès candidat indisponible' using errcode='42501'; end if;
 return new;
end $fn$;
revoke all on function public.enforce_candidate_access_for_credentials() from public,anon,authenticated;
create trigger candidate_session_access before insert or update of figurant_id,token,expires_at on public.figurant_sessions
for each row execute function public.enforce_candidate_access_for_credentials();
create trigger candidate_login_link_access before insert or update of figurant_id,token,expires_at,objet on public.figurant_auth_tokens
for each row execute function public.enforce_candidate_access_for_credentials();

-- Le retrait des accès et de tous les jetons est une seule transaction,
-- quel que soit le chemin applicatif qui désactive le profil.
create function public.revoke_candidate_credentials()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 delete from public.figurant_sessions where figurant_id=new.id;
 delete from public.figurant_auth_tokens where figurant_id=new.id;
 return new;
end $fn$;
revoke all on function public.revoke_candidate_credentials() from public,anon,authenticated;
create trigger candidate_access_revoked after update of acces_compte on public.figurants
for each row when (old.acces_compte and not new.acces_compte)
execute function public.revoke_candidate_credentials();
notify pgrst,'reload schema';
