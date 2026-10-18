-- Lien de validation MES depuis Bookings : toutes les journées à venir du
-- projet, avec les profils bookés. Le lien n'est alors rattaché à aucune
-- annonce, et les votes / commentaires portent sur la figurant·e.

alter table public.liens_validation alter column annonce_id drop not null;
alter table public.liens_validation add column source text not null default 'candidatures'
  check (source in ('candidatures', 'bookings'));
alter table public.liens_validation add constraint liens_validation_cible_check
  check (source = 'bookings' or annonce_id is not null);
create index liens_validation_projet_idx on public.liens_validation (projet_id) where source = 'bookings';

alter table public.lien_validation_votes alter column candidature_id drop not null;
alter table public.lien_validation_votes add column figurant_id uuid references public.figurants(id) on delete cascade;
alter table public.lien_validation_votes add constraint lien_validation_votes_profil_check
  check (candidature_id is not null or figurant_id is not null);
create unique index lien_validation_votes_figurant_key on public.lien_validation_votes (lien_id, figurant_id, visiteur_id);

alter table public.partage_commentaires add column figurant_id uuid references public.figurants(id) on delete set null;
