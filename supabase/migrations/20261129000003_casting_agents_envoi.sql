-- Date du dernier envoi du lien par email à l'agent (envoi groupé).
alter table public.casting_agents
  add column if not exists dernier_envoi_le timestamptz;
