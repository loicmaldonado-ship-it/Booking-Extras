-- Jours de tournage prévus pour une candidature, parmi les dates de son
-- annonce : on range quelqu'un sur un ou plusieurs jours avant de
-- l'envoyer, jour par jour, dans les journées de Bookings. Distinct des
-- onglets (un seul onglet par candidature, mais plusieurs jours possibles).
create table if not exists public.candidature_jours (
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  annonce_date_id uuid not null references public.annonce_dates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidature_id, annonce_date_id)
);

create index if not exists candidature_jours_annonce_date_id_idx on public.candidature_jours (annonce_date_id);

alter table public.candidature_jours enable row level security;

drop policy if exists "scoped by projet" on public.candidature_jours;
create policy "scoped by projet" on public.candidature_jours for all to authenticated
  using (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_jours.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_jours.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

grant all on public.candidature_jours to service_role, authenticated;
