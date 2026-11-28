-- Protect the subsequently added full-access flag and the profile identity.
-- BUG-01: A user may UPDATE their own profile under RLS; that must never
-- permit privilege escalation (role, owner, visibility pool or permissions).
-- Server-side administrative flows already use service_role.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' and (
    new.id is distinct from old.id
    or new.acces_complet is distinct from old.acces_complet
    or new.role is distinct from old.role
    or new.is_owner is distinct from old.is_owner
    or new.comedien_pool_id is distinct from old.comedien_pool_id
    or new.sections_autorisees is distinct from old.sections_autorisees
    or new.gmail_smtp_user is distinct from old.gmail_smtp_user
    or new.gmail_smtp_app_password is distinct from old.gmail_smtp_app_password
    or new.email_espace_perso_template is distinct from old.email_espace_perso_template
    or new.email_magic_link_template is distinct from old.email_magic_link_template
    or new.email is distinct from old.email
  ) then
    raise exception 'Modification de champs protégés interdite'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_privileges on public.profiles;
create trigger protect_profiles_privileges
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

revoke all on function public.prevent_profile_privilege_escalation() from public;
