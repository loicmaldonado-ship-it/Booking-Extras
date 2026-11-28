-- Un lien agent est rattaché à l'agent de la base commune (table agents) : mêmes
-- coordonnées partout, et on retrouve ses liens d'un projet à l'autre.
alter table public.casting_agents
  add column if not exists agent_id uuid references public.agents (id) on delete set null;
create index if not exists casting_agents_agent_id_idx on public.casting_agents (agent_id);
