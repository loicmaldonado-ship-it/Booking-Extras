-- Comptes candidat : connexion par lien magique (sans mot de passe),
-- indépendant du système d'auth Supabase des membres de l'équipe.

create table if not exists public.figurant_auth_tokens (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists figurant_auth_tokens_figurant_id_idx on public.figurant_auth_tokens (figurant_id);
create index if not exists figurant_auth_tokens_token_idx on public.figurant_auth_tokens (token);

create table if not exists public.figurant_sessions (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists figurant_sessions_figurant_id_idx on public.figurant_sessions (figurant_id);
create index if not exists figurant_sessions_token_idx on public.figurant_sessions (token);

alter table public.figurant_auth_tokens enable row level security;
alter table public.figurant_sessions enable row level security;

grant all on public.figurant_auth_tokens to service_role;
grant all on public.figurant_sessions to service_role;
