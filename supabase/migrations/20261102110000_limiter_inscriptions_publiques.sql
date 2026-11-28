-- Inscription, candidature et casting publics : limite de débit distribuée (audit du 31/10/2026).
-- Par connexion réseau : 100 créations par heure (une salle de casting en Wi-Fi ou un opérateur mobile
-- partage souvent la même adresse). Par adresse email : 8 par heure. Clés : HMAC calculés par le serveur,
-- aucune adresse IP ni email en clair n'est stockée.
create table if not exists public.limites_publiques (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  period_started_at timestamptz not null,
  attempts integer not null
);
alter table public.limites_publiques enable row level security;
revoke all on table public.limites_publiques from public, anon, authenticated;
grant all on table public.limites_publiques to service_role;

create or replace function public.consommer_limite_publique(p_reseau_hash text, p_email_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $fn$
declare k record; n integer; autorise boolean := true;
begin
  if p_reseau_hash is null or p_email_hash is null
     or p_reseau_hash !~ '^[0-9a-f]{64}$' or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_reseau_hash = p_email_hash then return false; end if;
  -- Ordre commun des verrous : évite les interblocages entre requêtes concurrentes.
  for k in select * from (values (p_reseau_hash, 100), (p_email_hash, 8)) as cles(hash, lim) order by hash loop
    insert into public.limites_publiques as l (key_hash, period_started_at, attempts) values (k.hash, now(), 1)
    on conflict (key_hash) do update set
      attempts = case when l.period_started_at <= now() - interval '1 hour' then 1 else least(l.attempts + 1, 1000000) end,
      period_started_at = case when l.period_started_at <= now() - interval '1 hour' then now() else l.period_started_at end
    returning attempts into n;
    autorise := autorise and n <= k.lim;
  end loop;
  delete from public.limites_publiques where period_started_at < now() - interval '24 hours';
  return autorise;
end $fn$;
revoke all on function public.consommer_limite_publique(text, text) from public, anon, authenticated;
grant execute on function public.consommer_limite_publique(text, text) to service_role;
