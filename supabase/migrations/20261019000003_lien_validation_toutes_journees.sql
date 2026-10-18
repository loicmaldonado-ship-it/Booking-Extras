-- Lien de validation MES « toutes les journées » : reprend, en direct, les
-- profils prévus sur chaque jour de l'annonce et ceux déjà dans la journée,
-- en plus des profils ajoutés à la main.
alter table public.liens_validation add column toutes_journees boolean not null default false;
