-- Barème par équipe (décision Maxime du 30/10/2026, BUG-02).
-- Avant : bareme_cachets / bareme_majorations formaient UNE grille commune modifiable et supprimable par toute
-- cheffe, y compris d'une autre équipe. Désormais :
--   * les lignes existantes (equipe_id NULL) restent la grille ACFDA de référence, jamais modifiée par l'application ;
--   * chaque équipe (clé = comedien_pool_id du·de la propriétaire du projet, sinon son id, comme les modèles de
--     messages) reçoit, à sa première modification, une copie de la référence (copier_bareme_equipe) ;
--   * tant qu'une équipe n'a rien modifié, elle lit la référence.
-- Aucune ligne existante n'est modifiée ni supprimée par cette migration. Tables toujours réservées à service_role.
begin;

alter table public.bareme_cachets add column if not exists equipe_id uuid references public.profiles(id) on delete cascade;
alter table public.bareme_cachets add column if not exists source_id uuid;
alter table public.bareme_majorations add column if not exists equipe_id uuid references public.profiles(id) on delete cascade;
alter table public.bareme_majorations add column if not exists source_id uuid;

-- L'unicité (convention, cachet, date_effet) devient propre à chaque équipe (la référence = équipe NULL).
alter table public.bareme_cachets drop constraint if exists bareme_cachets_convention_cachet_date_effet_key;
create unique index if not exists bareme_cachets_equipe_convention_cachet_date_key
  on public.bareme_cachets (coalesce(equipe_id, '00000000-0000-0000-0000-000000000000'::uuid), convention, cachet, date_effet);
create unique index if not exists bareme_cachets_equipe_source_key on public.bareme_cachets (equipe_id, source_id) where equipe_id is not null and source_id is not null;
create unique index if not exists bareme_majorations_equipe_source_key on public.bareme_majorations (equipe_id, source_id) where equipe_id is not null and source_id is not null;
create index if not exists bareme_cachets_equipe_idx on public.bareme_cachets (equipe_id);
create index if not exists bareme_majorations_equipe_idx on public.bareme_majorations (equipe_id);

-- Équipes ayant leur propre barème (marqueur posé une seule fois : une ligne supprimée par l'équipe n'est jamais recopiée).
create table if not exists public.bareme_equipes (
  equipe_id uuid primary key references public.profiles(id) on delete cascade,
  initialise_le timestamptz not null default now()
);
alter table public.bareme_equipes enable row level security;
revoke all on table public.bareme_equipes from public, anon, authenticated;
grant select, insert, update, delete on table public.bareme_equipes to service_role;

-- Clé d'équipe d'un projet : même règle que les modèles de messages (src/lib/templates/equipe.ts).
create or replace function public.equipe_cle_projet(pid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(p.comedien_pool_id, p.id) from public.projets j join public.profiles p on p.id = j.owner_id where j.id = pid;
$$;
revoke all on function public.equipe_cle_projet(uuid) from public, anon, authenticated;
grant execute on function public.equipe_cle_projet(uuid) to service_role;

-- Copie atomique et idempotente de la référence pour une équipe, et rattachement des majorations déjà appliquées
-- aux bookings de ses projets vers ses propres lignes.
create or replace function public.copier_bareme_equipe(p_equipe uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted int;
begin
  if p_equipe is null or not exists (select 1 from public.profiles where id = p_equipe) then
    raise exception 'Équipe inconnue';
  end if;
  perform pg_advisory_xact_lock(hashtext('bareme_equipe:' || p_equipe::text));
  insert into public.bareme_equipes(equipe_id) values (p_equipe) on conflict (equipe_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;

  insert into public.bareme_cachets (convention, cachet, montant_brut, date_effet, notes, equipe_id, source_id)
  select convention, cachet, montant_brut, date_effet, notes, p_equipe, id from public.bareme_cachets where equipe_id is null;

  insert into public.bareme_majorations (convention, type, label, valeur_type, valeur, cinema_uniquement, notes, date_effet, equipe_id, source_id)
  select convention, type, label, valeur_type, valeur, cinema_uniquement, notes, date_effet, p_equipe, id from public.bareme_majorations where equipe_id is null;

  update public.booking_majorations bm
     set bareme_majoration_id = copie.id
    from public.bareme_majorations copie, public.bookings b
   where copie.equipe_id = p_equipe
     and copie.source_id = bm.bareme_majoration_id
     and b.id = bm.booking_id
     and public.equipe_cle_projet(b.projet_id) = p_equipe;
  return true;
end;
$$;
revoke all on function public.copier_bareme_equipe(uuid) from public, anon, authenticated;
grant execute on function public.copier_bareme_equipe(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
