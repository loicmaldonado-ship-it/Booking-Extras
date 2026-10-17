-- Dernier message envoyé par chaque membre de l'équipe, par endroit
-- (message libre d'une journée, message d'un rôle de casting, message aux
-- candidatures…) : repris à la prochaine ouverture, sur tous ses appareils.
create table if not exists public.derniers_messages (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  contexte text not null,
  sujet text,
  corps text not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, contexte)
);
alter table public.derniers_messages enable row level security;
grant all on public.derniers_messages to service_role;
