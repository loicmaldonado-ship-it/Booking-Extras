-- Abonnements aux notifications push (Web Push), pour alerter un figurant
-- sur son téléphone quand il reçoit un message interne.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  figurant_id uuid not null references public.figurants (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_figurant_id_idx on public.push_subscriptions (figurant_id);

alter table public.push_subscriptions enable row level security;

grant all on public.push_subscriptions to service_role;
