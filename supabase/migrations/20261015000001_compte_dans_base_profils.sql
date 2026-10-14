-- Toute personne qui a créé son compte candidat·e (mot de passe) apparaît
-- dans la Base Profils (figurants.confirme), sans attendre un booking.

create or replace function public.compte_candidat_dans_base()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.figurants set confirme = true where id = new.figurant_id and not confirme;
  return new;
end;
$$;

drop trigger if exists figurant_comptes_dans_base on public.figurant_comptes;
create trigger figurant_comptes_dans_base
  after insert on public.figurant_comptes
  for each row
  execute function public.compte_candidat_dans_base();

-- Comptes déjà créés.
update public.figurants f
   set confirme = true
  from public.figurant_comptes c
 where c.figurant_id = f.id
   and not f.confirme;
