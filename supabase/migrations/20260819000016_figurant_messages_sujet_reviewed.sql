alter table public.figurant_messages
  add column if not exists sujet text,
  add column if not exists reviewed_at timestamptz;
