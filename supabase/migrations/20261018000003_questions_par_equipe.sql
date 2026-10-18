-- Questions d'annonce enregistrées (suggestions) cloisonnées par équipe,
-- comme les modèles de messages : clé = comedien_pool_id de la cheffe
-- propriétaire du projet, sinon son id.
alter table public.question_templates
  add column equipe_id uuid references public.profiles(id) on delete cascade;
alter table public.question_templates drop constraint if exists question_templates_label_key;

-- Chaque question va à l'équipe (ou aux équipes) qui l'a utilisée dans une
-- annonce.
insert into public.question_templates (label, equipe_id)
select distinct q.label, coalesce(pr.comedien_pool_id, pr.id)
from public.annonce_questions q
join public.annonces a on a.id = q.annonce_id
join public.projets p on p.id = a.projet_id
join public.profiles pr on pr.id = p.owner_id
where q.label in (select label from public.question_templates where equipe_id is null);

delete from public.question_templates t
where t.equipe_id is null
  and exists (select 1 from public.question_templates x where x.label = t.label and x.equipe_id is not null);

-- Celles qui ne sont plus utilisées nulle part : équipe du compte
-- propriétaire (à défaut, la première cheffe).
update public.question_templates
set equipe_id = (
  select coalesce(p.comedien_pool_id, p.id)
  from public.profiles p
  where p.role = 'chef'
  order by p.is_owner desc, p.created_at
  limit 1
)
where equipe_id is null;

create unique index if not exists question_templates_equipe_label_idx
  on public.question_templates (equipe_id, label);

-- Accès uniquement par le serveur (client admin), filtré par équipe.
drop policy if exists "authenticated read/write" on public.question_templates;
revoke all on public.question_templates from authenticated;
grant all on public.question_templates to service_role;
