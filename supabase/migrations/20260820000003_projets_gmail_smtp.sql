alter table public.projets
  add column if not exists gmail_smtp_user text,
  add column if not exists gmail_smtp_app_password text;
