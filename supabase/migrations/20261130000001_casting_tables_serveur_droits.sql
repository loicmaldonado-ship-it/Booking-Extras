-- Même règle que les autres tables serveur (20261024132303) : les onglets de casting, les agents
-- et leurs propositions ne sont lus et écrits que par le serveur (service_role). L'API publique
-- (anon) et les comptes connectés (authenticated) n'ont aucun droit direct dessus, TRUNCATE compris
-- (TRUNCATE échappe à la RLS).
begin;

drop policy if exists "scoped by projet" on public.casting_onglets;
drop policy if exists "scoped by projet" on public.casting_agents;
drop policy if exists "scoped by projet" on public.casting_propositions_agents;

revoke all on table public.casting_onglets, public.casting_agents, public.casting_propositions_agents
  from public, anon, authenticated;
grant select, insert, update, delete on table
  public.casting_onglets, public.casting_agents, public.casting_propositions_agents
  to service_role;

commit;
