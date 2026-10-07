-- Marque permanente « envoyée en booking » sur la candidature.
--
-- Avant : une candidature était masquée tant qu'un booking la référençait
-- (bookings.candidature_id, unique). Sur plusieurs jours, seul le premier
-- booking porte ce lien : le supprimer ou le retirer du planning (même si
-- la personne reste bookée les autres jours) faisait réapparaître la
-- candidature. Règle de Loïc : une fois envoyée en booking, une candidature
-- ne réapparaît plus jamais dans son annonce.

alter table public.candidatures
  add column if not exists envoyee_en_booking_le timestamptz;

-- Posée par la base à chaque rattachement d'un booking, quel que soit le
-- chemin dans l'appli ; jamais effacée (ni par la suppression du booking,
-- ni par le « on delete set null » de bookings.candidature_id).
create or replace function public.marquer_candidature_envoyee_en_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.candidatures
     set envoyee_en_booking_le = coalesce(envoyee_en_booking_le, now())
   where id = new.candidature_id
     and envoyee_en_booking_le is null;
  return new;
end;
$$;

drop trigger if exists bookings_marquer_candidature on public.bookings;
create trigger bookings_marquer_candidature
  after insert or update of candidature_id on public.bookings
  for each row
  when (new.candidature_id is not null)
  execute function public.marquer_candidature_envoyee_en_booking();

-- Reprise de l'existant : candidatures encore rattachées à un booking…
update public.candidatures c
   set envoyee_en_booking_le = b.created_at
  from public.bookings b
 where b.candidature_id = c.id
   and c.envoyee_en_booking_le is null;

-- …et celles dont le lien a été perdu (booking supprimé ou retiré du
-- planning) alors que la personne est bookée sur un jour de l'annonce, sur
-- le projet de l'annonce.
update public.candidatures c
   set envoyee_en_booking_le = sub.premier
  from (
    select c2.id, min(b.created_at) as premier
      from public.candidatures c2
      join public.annonces a on a.id = c2.annonce_id
      join public.annonce_dates d on d.annonce_id = c2.annonce_id
      join public.bookings b
        on b.figurant_id = c2.figurant_id
       and b.projet_id = a.projet_id
       and b.date = d.date
     where c2.envoyee_en_booking_le is null
     group by c2.id
  ) sub
 where sub.id = c.id;
