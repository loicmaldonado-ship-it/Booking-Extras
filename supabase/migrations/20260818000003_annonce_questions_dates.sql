-- Questions Oui/Non réutilisables (banque de templates) + questions
-- effectivement attachées à une annonce, et les réponses des candidats.

create table if not exists public.question_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.annonce_questions (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces (id) on delete cascade,
  label text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists annonce_questions_annonce_id_idx on public.annonce_questions (annonce_id);

create table if not exists public.candidature_reponses (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  annonce_question_id uuid not null references public.annonce_questions (id) on delete cascade,
  reponse boolean not null,
  created_at timestamptz not null default now(),
  unique (candidature_id, annonce_question_id)
);

create index if not exists candidature_reponses_candidature_id_idx on public.candidature_reponses (candidature_id);

-- Dates proposées par la cheffe pour une annonce, et la disponibilité de
-- chaque candidat sur chacune de ces dates.

create table if not exists public.annonce_dates (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (annonce_id, date)
);

create index if not exists annonce_dates_annonce_id_idx on public.annonce_dates (annonce_id);

create table if not exists public.candidature_disponibilites (
  id uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  annonce_date_id uuid not null references public.annonce_dates (id) on delete cascade,
  disponible boolean not null,
  created_at timestamptz not null default now(),
  unique (candidature_id, annonce_date_id)
);

create index if not exists candidature_disponibilites_candidature_id_idx on public.candidature_disponibilites (candidature_id);

alter table public.question_templates enable row level security;
alter table public.annonce_questions enable row level security;
alter table public.candidature_reponses enable row level security;
alter table public.annonce_dates enable row level security;
alter table public.candidature_disponibilites enable row level security;

drop policy if exists "authenticated read/write" on public.question_templates;
create policy "authenticated read/write" on public.question_templates for all to authenticated
  using (true) with check (true);

drop policy if exists "scoped by projet" on public.annonce_questions;
create policy "scoped by projet" on public.annonce_questions for all to authenticated
  using (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_questions.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_questions.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

drop policy if exists "scoped by projet" on public.candidature_reponses;
create policy "scoped by projet" on public.candidature_reponses for all to authenticated
  using (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_reponses.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_reponses.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

drop policy if exists "scoped by projet" on public.annonce_dates;
create policy "scoped by projet" on public.annonce_dates for all to authenticated
  using (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_dates.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_dates.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

drop policy if exists "scoped by projet" on public.candidature_disponibilites;
create policy "scoped by projet" on public.candidature_disponibilites for all to authenticated
  using (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_disponibilites.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.candidatures
      join public.annonces on annonces.id = candidatures.annonce_id
      where candidatures.id = candidature_disponibilites.candidature_id
        and public.has_projet_access(annonces.projet_id)
    )
  );

grant all on public.question_templates to service_role, authenticated;
grant all on public.annonce_questions to service_role, authenticated;
grant all on public.candidature_reponses to service_role, authenticated;
grant all on public.annonce_dates to service_role, authenticated;
grant all on public.candidature_disponibilites to service_role, authenticated;
