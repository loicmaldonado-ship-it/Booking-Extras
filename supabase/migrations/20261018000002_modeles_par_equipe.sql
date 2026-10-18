-- Modèles de messages cloisonnés par équipe : une cheffe (et ses
-- assistant·es) ne voit que les modèles de son équipe. La clé d'équipe est
-- la même que pour les fiches comédien·nes : comedien_pool_id, sinon l'id de
-- la cheffe.
alter table public.message_templates
  add column equipe_id uuid references public.profiles(id) on delete cascade;

create index if not exists message_templates_equipe_idx on public.message_templates (equipe_id);

-- Les modèles existants appartiennent à l'équipe du compte propriétaire
-- (à défaut, la première cheffe).
update public.message_templates
set equipe_id = (
  select coalesce(p.comedien_pool_id, p.id)
  from public.profiles p
  where p.role = 'chef'
  order by p.is_owner desc, p.created_at
  limit 1
)
where equipe_id is null;

-- Les quatre modèles de base (jamais modifiés) sont copiés pour chaque autre
-- équipe, pour que personne ne perde les modèles qu'il utilisait.
insert into public.message_templates (nom, sujet, corps, equipe_id)
select t.nom, t.sujet, t.corps, e.cle
from public.message_templates t
cross join (
  select distinct coalesce(comedien_pool_id, id) as cle from public.profiles where role = 'chef'
) e
where t.nom in ('Relance sans réponse', 'Refus de candidature', 'Proposition rôle / silhouette', 'Proposition de booking')
  and t.equipe_id is not null
  and e.cle <> t.equipe_id
  and not exists (select 1 from public.message_templates x where x.equipe_id = e.cle and x.nom = t.nom);

-- Accès uniquement par le serveur (client admin), filtré par équipe.
drop policy if exists "authenticated full access" on public.message_templates;
revoke all on public.message_templates from authenticated;
grant all on public.message_templates to service_role;
