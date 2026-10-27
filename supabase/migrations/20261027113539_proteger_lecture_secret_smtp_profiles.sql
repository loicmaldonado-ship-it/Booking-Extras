-- SMTP: conserver les noms et informations d’équipe, sans exposer le secret.
-- Aucune ligne ni valeur n’est modifiée. Les usages SMTP sont server-only/service_role.
begin;
revoke all on table public.profiles from public, anon, authenticated;
revoke select (gmail_smtp_app_password) on table public.profiles from public, anon, authenticated;
grant select (
  id, nom, role, created_at, updated_at, email, last_seen_at, avatar_storage_path,
  gmail_smtp_user, prenom, telephone, email_espace_perso_template,
  email_magic_link_template, sections_autorisees, is_owner, comedien_pool_id, acces_complet
) on table public.profiles to authenticated;
-- Même accès métier que la réconciliation validée de tests ; le trigger protège les privilèges.
grant update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- Reprise ciblée, sans modification, des droits validés dans 5644d59.
-- REVOKE I/U/D seul laisse notamment TRUNCATE hors RLS sur les anciens GRANT ALL.
revoke all on table public.figurants from public, anon, authenticated;
grant select, insert, update, delete on table public.figurants to service_role;
grant select on table public.figurants to authenticated;
revoke all on table public.figurant_photos from public, anon, authenticated;
grant select, insert, update, delete on table public.figurant_photos to service_role;
grant select on table public.figurant_photos to authenticated;
revoke all on table public.figurant_liens from public, anon, authenticated;
grant select, insert, update, delete on table public.figurant_liens to service_role;
grant select on table public.figurant_liens to authenticated;
revoke all on table public.figurant_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.figurant_sessions to service_role;
revoke all on table public.figurant_auth_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.figurant_auth_tokens to service_role;
revoke all on table public.figurant_comptes from public, anon, authenticated;
grant select, insert, update, delete on table public.figurant_comptes to service_role;
notify pgrst, 'reload schema';
commit;
