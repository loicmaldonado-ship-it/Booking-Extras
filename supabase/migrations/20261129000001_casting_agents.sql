-- Lien spécial agent : un lien PAR agent (chacun ne voit que ses propositions)
-- qui montre les rôles « ouverts aux agents » et laisse proposer des profils
-- (photos, infos, liens vers sa page de comédien). Les propositions arrivent
-- d'abord dans une boîte de réception, avant d'entrer dans un rôle.

-- Fiche « breakdown » d'un rôle, montrée aux agents (distincte du message
-- d'invitation envoyé aux profils) + interrupteur « ouvert aux agents ».
alter table public.casting_roles
  add column if not exists ouvert_agents boolean not null default false,
  add column if not exists agents_description text,
  add column if not exists agents_age text,
  add column if not exists agents_sequence text,
  add column if not exists agents_repliques text;

create table public.casting_agents (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  nom text not null check (length(btrim(nom)) > 0),
  agence text,
  email text,
  token uuid not null unique default gen_random_uuid(),
  actif boolean not null default true,
  -- Montre aussi les répliques d'essai de chaque rôle à cet agent.
  afficher_repliques boolean not null default false,
  created_at timestamptz not null default now()
);
create index casting_agents_projet_id_idx on public.casting_agents (projet_id);

create table public.casting_propositions_agents (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  agent_id uuid not null references public.casting_agents (id) on delete cascade,
  role_id uuid not null references public.casting_roles (id) on delete cascade,
  prenom text not null,
  nom text not null,
  age text,
  taille text,
  lien_page text,
  lien_bande_demo text,
  note text,
  -- Chemins des photos dans le stockage « agent-propositions ».
  photos text[] not null default '{}',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee')),
  -- Profil de casting créé à l'acceptation.
  entry_id uuid references public.casting_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  traite_le timestamptz
);
create index casting_propositions_agents_projet_idx on public.casting_propositions_agents (projet_id, statut);
create index casting_propositions_agents_agent_idx on public.casting_propositions_agents (agent_id);

alter table public.casting_agents enable row level security;
alter table public.casting_propositions_agents enable row level security;
create policy "scoped by projet" on public.casting_agents for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
create policy "scoped by projet" on public.casting_propositions_agents for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
grant all on public.casting_agents, public.casting_propositions_agents to service_role, authenticated;

-- Photos envoyées par les agents : privé, lu et écrit seulement par le serveur.
insert into storage.buckets (id, name, public, file_size_limit)
values ('agent-propositions', 'agent-propositions', false, 10485760)
on conflict (id) do nothing;
