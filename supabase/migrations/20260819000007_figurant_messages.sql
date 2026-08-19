-- Messagerie interne figurant <-> équipe, en remplacement des mails/SMS pour
-- les comptes candidat connectés (lien magique).

create table if not exists public.figurant_messages (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  sender text not null check (sender in ('staff', 'figurant')),
  corps text not null,
  bien_recu boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists figurant_messages_figurant_id_idx on public.figurant_messages (figurant_id);

alter table public.figurant_messages enable row level security;

grant all on public.figurant_messages to service_role;
