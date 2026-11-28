-- BUG-09: distributed throttling of candidate login and magic-link requests.
-- A key is the SHA-256 of a normalized email; no raw email is stored here.
-- The function is executable only by service_role: never expose it directly to public clients.
create table if not exists public.candidate_auth_attempts (
  key_hash text primary key,
  period_started_at timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.candidate_auth_attempts enable row level security;
revoke all on table public.candidate_auth_attempts from anon, authenticated, public;
grant select, insert, update, delete on table public.candidate_auth_attempts to service_role;

create or replace function public.consume_candidate_auth_attempt(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempts_in_window integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  insert into public.candidate_auth_attempts as a (key_hash, period_started_at, attempts)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update set
    period_started_at = case when a.period_started_at < now() - interval '15 minutes' then now()
      else a.period_started_at end,
    attempts = case when a.period_started_at < now() - interval '15 minutes' then 1
      else a.attempts + 1 end
  returning attempts into attempts_in_window;
  return attempts_in_window <= 6;
end;
$$;
revoke all on function public.consume_candidate_auth_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_candidate_auth_attempt(text) to service_role;
-- Retention: schedule periodic cleanup in infrastructure or purge operationally
-- by deleting rows with period_started_at older than 24 hours.
