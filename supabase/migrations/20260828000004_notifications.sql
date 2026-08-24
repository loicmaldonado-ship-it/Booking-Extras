-- Notifications staff — flux d'événements (candidature reçue, réponse d'un
-- candidat, compte activé) partagé entre tous les membres de l'équipe. Pas
-- de statut lu/non-lu par personne : à ce stade l'équipe travaille sur les
-- mêmes données partagées, donc marquer comme lu vaut pour tout le monde.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('candidature', 'reponse', 'compte_cree')),
  titre text not null,
  figurant_id uuid references public.figurants (id) on delete cascade,
  lien text,
  lu_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_created_at_idx on public.notifications (created_at desc);
create index notifications_unread_idx on public.notifications (lu_at) where lu_at is null;

alter table public.notifications enable row level security;

create policy "authenticated full access" on public.notifications
  for all to authenticated using (true) with check (true);

grant all on public.notifications to service_role, authenticated;
