-- Corrections d'intégrité inter-projets pour les étiquettes et la réserve.
-- Ces politiques s'appliquent aussi si la migration du 20/10 a déjà été exécutée.

drop policy if exists "scoped by projet" on public.candidature_etiquette_liens;
create policy "scoped by projet" on public.candidature_etiquette_liens
  for all to authenticated
  using (
    exists (
      select 1
      from public.candidature_etiquettes e
      join public.candidatures c on c.id = candidature_etiquette_liens.candidature_id
      join public.annonces a on a.id = c.annonce_id
      where e.id = candidature_etiquette_liens.etiquette_id
        and e.projet_id = a.projet_id
        and public.has_projet_access(e.projet_id)
    )
  )
  with check (
    exists (
      select 1
      from public.candidature_etiquettes e
      join public.candidatures c on c.id = candidature_etiquette_liens.candidature_id
      join public.annonces a on a.id = c.annonce_id
      where e.id = candidature_etiquette_liens.etiquette_id
        and e.projet_id = a.projet_id
        and public.has_projet_access(e.projet_id)
    )
  );

drop policy if exists "scoped by projet" on public.reserve_profils;
create policy "scoped by projet" on public.reserve_profils
  for all to authenticated
  using (
    public.has_projet_access(projet_id)
    and (
      candidature_id is null
      or exists (
        select 1
        from public.candidatures c
        join public.annonces a on a.id = c.annonce_id
        where c.id = reserve_profils.candidature_id
          and c.figurant_id = reserve_profils.figurant_id
          and a.projet_id = reserve_profils.projet_id
      )
    )
  )
  with check (
    public.has_projet_access(projet_id)
    and (
      candidature_id is null
      or exists (
        select 1
        from public.candidatures c
        join public.annonces a on a.id = c.annonce_id
        where c.id = reserve_profils.candidature_id
          and c.figurant_id = reserve_profils.figurant_id
          and a.projet_id = reserve_profils.projet_id
      )
    )
  );
