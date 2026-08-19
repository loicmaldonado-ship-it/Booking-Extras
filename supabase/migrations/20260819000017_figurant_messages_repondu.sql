alter table public.figurant_messages
  add column if not exists repondu boolean not null default false;
