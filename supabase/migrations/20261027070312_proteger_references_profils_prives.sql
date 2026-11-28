-- Own-pool actors remain visible even without a candidate account.
-- Les profils sans compte restent dans les projets qui les ont ajoutés.
drop policy if exists "figurants read scope" on public.figurants;
create policy "figurants read scope" on public.figurants for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid())
  and (
    public.is_owner()
    or (est_comedien and comedien_pool_id = coalesce(
        (select p.comedien_pool_id from public.profiles p where p.id = auth.uid()), auth.uid()))
    or (not est_comedien and (
        acces_compte
        or (temporaire_projet_id is not null and public.has_projet_access(temporaire_projet_id))
        or exists (select 1 from public.bookings b where b.figurant_id = figurants.id and public.has_projet_access(b.projet_id))
        or exists (select 1 from public.casting_entries c where c.figurant_id = figurants.id and public.has_projet_access(c.projet_id))
        or exists (select 1 from public.essayages e where e.figurant_id = figurants.id and public.has_projet_access(e.projet_id))
      )
    )
  )
);

-- A project membership does not authorize attaching an otherwise hidden person.
-- Check before INSERT, before that relationship could itself grant visibility.
create or replace function public.enforce_staff_person_reference()
returns trigger language plpgsql set search_path = '' as $$
declare subject uuid; driver uuid;
begin
 if current_setting('role',true) is distinct from 'authenticated' then return new; end if;
 subject := (to_jsonb(new)->>'figurant_id')::uuid;
 driver := (to_jsonb(new)->>'covoiturage_conducteur_id')::uuid;
 if subject is not null and not exists(select 1 from public.figurants where id=subject) then
  raise exception 'Profil introuvable ou inaccessible' using errcode='42501';
 end if;
 if driver is not null and not exists(select 1 from public.figurants where id=driver) then
  raise exception 'Profil conducteur introuvable ou inaccessible' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function public.enforce_staff_person_reference() from public, anon, authenticated;

create trigger staff_person_reference before insert or update of figurant_id,projet_id,covoiturage_conducteur_id on public.bookings
for each row execute function public.enforce_staff_person_reference();
create trigger staff_person_reference before insert or update of figurant_id,projet_id on public.essayages
for each row execute function public.enforce_staff_person_reference();
create trigger staff_person_reference before insert or update of figurant_id,projet_id on public.casting_entries
for each row execute function public.enforce_staff_person_reference();
create trigger staff_person_reference before insert or update of figurant_id,projet_id on public.casting_presentiel_entries
for each row execute function public.enforce_staff_person_reference();
create trigger staff_person_reference before insert or update of figurant_id,annonce_id on public.candidatures
for each row execute function public.enforce_staff_person_reference();
