-- Liens de partage scopés à une seule journée (bouton "Partager la
-- journée" dans Bookings), avec un choix explicite d'afficher ou non les
-- coordonnées (téléphone/email) des profils.

create table if not exists public.partage_journee_liens (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets (id) on delete cascade,
  date date not null,
  show_contacts boolean not null default false,
  token text not null unique,
  created_at timestamptz not null default now(),
  unique (projet_id, date)
);

create index if not exists partage_journee_liens_projet_id_idx on public.partage_journee_liens (projet_id);

alter table public.partage_journee_liens enable row level security;

drop policy if exists "scoped by projet" on public.partage_journee_liens;
create policy "scoped by projet" on public.partage_journee_liens for all to authenticated
  using (public.has_projet_access(projet_id))
  with check (public.has_projet_access(projet_id));

grant all on public.partage_journee_liens to service_role, authenticated;
