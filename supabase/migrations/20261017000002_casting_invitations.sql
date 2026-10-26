-- Invitations par email à un rôle de casting (personnes pas encore dans la
-- base) : le mail contient le lien rapide du rôle. Sert à ne pas inviter
-- deux fois et à suivre qui a répondu.
create table if not exists public.casting_invitations (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.casting_roles (id) on delete cascade,
  email text not null,
  invite_le timestamptz not null default now(),
  unique (role_id, email)
);
create index if not exists casting_invitations_role_idx on public.casting_invitations (role_id);
alter table public.casting_invitations enable row level security;
grant all on public.casting_invitations to service_role;
