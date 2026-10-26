-- Les profils sans compte restent dans les projets qui les ont ajoutés.
drop policy if exists "figurants read scope" on public.figurants;
create policy "figurants read scope" on public.figurants for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid())
  and (
    public.is_owner()
    or (
      (not est_comedien or comedien_pool_id = coalesce(
        (select p.comedien_pool_id from public.profiles p where p.id = auth.uid()), auth.uid()))
      and (
        acces_compte
        or (temporaire_projet_id is not null and public.has_projet_access(temporaire_projet_id))
        or exists (select 1 from public.bookings b where b.figurant_id = figurants.id and public.has_projet_access(b.projet_id))
        or exists (select 1 from public.casting_entries c where c.figurant_id = figurants.id and public.has_projet_access(c.projet_id))
        or exists (select 1 from public.essayages e where e.figurant_id = figurants.id and public.has_projet_access(e.projet_id))
      )
    )
  )
);
