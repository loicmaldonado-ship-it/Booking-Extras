-- Lien de validation pour la mise en scène / la réalisation : des profils
-- de Candidatures en planches, votés sans compte (Valider / Peut-être / Non)
-- avec une note. Visites et commentaires sont génériques (type + id de
-- lien) pour servir ensuite aux autres liens de partage.

create table public.liens_validation (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  annonce_id uuid not null references public.annonces(id) on delete cascade,
  projet_id uuid not null references public.projets(id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 120),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index liens_validation_annonce_idx on public.liens_validation (annonce_id);

create table public.lien_validation_profils (
  lien_id uuid not null references public.liens_validation(id) on delete cascade,
  candidature_id uuid not null references public.candidatures(id) on delete cascade,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (lien_id, candidature_id)
);
create index lien_validation_profils_candidature_idx on public.lien_validation_profils (candidature_id);

-- Un vote par personne (appareil) et par profil ; le dernier vote d'un
-- profil fait foi côté équipe.
create table public.lien_validation_votes (
  id uuid primary key default gen_random_uuid(),
  lien_id uuid not null references public.liens_validation(id) on delete cascade,
  candidature_id uuid not null references public.candidatures(id) on delete cascade,
  visiteur_id text not null check (char_length(visiteur_id) between 8 and 64),
  visiteur_nom text not null default '',
  visiteur_role text not null default '',
  vote text check (vote in ('oui', 'peut', 'non')),
  note text not null default '' check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  unique (lien_id, candidature_id, visiteur_id)
);
create index lien_validation_votes_candidature_idx on public.lien_validation_votes (candidature_id);

-- Qui a ouvert un lien de partage (prénom + rôle demandés à l'arrivée,
-- une fois par appareil) et quand pour la dernière fois (« en ligne »).
create table public.partage_visites (
  id uuid primary key default gen_random_uuid(),
  lien_type text not null check (lien_type in ('validation')),
  lien_id uuid not null,
  visiteur_id text not null check (char_length(visiteur_id) between 8 and 64),
  prenom text not null check (char_length(prenom) between 1 and 60),
  role text not null default '' check (char_length(role) <= 60),
  premiere_visite timestamptz not null default now(),
  derniere_vue timestamptz not null default now(),
  unique (lien_type, lien_id, visiteur_id)
);
create index partage_visites_lien_idx on public.partage_visites (lien_type, lien_id);

-- Fil de commentaires d'un lien : visiteur·ses (visiteur_id) et réponses de
-- l'équipe (profile_id), éventuellement à propos d'un profil.
create table public.partage_commentaires (
  id uuid primary key default gen_random_uuid(),
  lien_type text not null check (lien_type in ('validation')),
  lien_id uuid not null,
  visiteur_id text,
  profile_id uuid references public.profiles(id) on delete set null,
  auteur text not null default '',
  candidature_id uuid references public.candidatures(id) on delete set null,
  texte text not null check (char_length(texte) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index partage_commentaires_lien_idx on public.partage_commentaires (lien_type, lien_id, created_at);

alter table public.liens_validation enable row level security;
alter table public.lien_validation_profils enable row level security;
alter table public.lien_validation_votes enable row level security;
alter table public.partage_visites enable row level security;
alter table public.partage_commentaires enable row level security;

grant all on public.liens_validation, public.lien_validation_profils, public.lien_validation_votes,
  public.partage_visites, public.partage_commentaires to service_role;

-- Notification « validation » (votes et commentaires de la MES).
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['candidature', 'reponse', 'compte_cree', 'casting', 'validation']));
