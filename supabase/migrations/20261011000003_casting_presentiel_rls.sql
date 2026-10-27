-- BUG-07 / SEC-03: access to the audition schedule is scoped by project,
-- not by a global "authenticated" role. New migration; old migrations immutable.

alter table public.casting_presentiel_creneaux enable row level security;
alter table public.casting_presentiel_entries enable row level security;

drop policy if exists "authenticated full access" on public.casting_presentiel_creneaux;
drop policy if exists "authenticated full access" on public.casting_presentiel_entries;

drop policy if exists "scoped by audition project" on public.casting_presentiel_creneaux;
create policy "scoped by audition project"
on public.casting_presentiel_creneaux for all to authenticated
using (exists (
  select 1 from public.casting_presentiel_journees j
  where j.id = journee_id and public.has_projet_access(j.projet_id)
))
with check (exists (
  select 1 from public.casting_presentiel_journees j
  where j.id = journee_id and public.has_projet_access(j.projet_id)
));

drop policy if exists "scoped by entry project and appointment" on public.casting_presentiel_entries;
create policy "scoped by entry project and appointment"
on public.casting_presentiel_entries for all to authenticated
using (public.has_projet_access(projet_id) and exists (
  select 1 from public.casting_presentiel_journees j
  where j.id = journee_id and j.projet_id = casting_presentiel_entries.projet_id
))
with check (public.has_projet_access(projet_id) and exists (
  select 1 from public.casting_presentiel_journees j
  where j.id = journee_id and j.projet_id = casting_presentiel_entries.projet_id
) and (creneau_id is null or exists (
  select 1 from public.casting_presentiel_creneaux c
  where c.id = creneau_id and c.journee_id = casting_presentiel_entries.journee_id
)));
