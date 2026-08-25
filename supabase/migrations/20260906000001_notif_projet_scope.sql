-- Les notifications (candidature reçue, casting envoyé) étaient partagées
-- entre TOUTES les chef·fes, y compris pour des projets privés d'une autre
-- équipe — incohérent avec l'isolation multi-chef·fes déjà en place sur
-- Projets/Annonces/Casting (voir 20260901000001_multi_chef_isolation.sql).
-- projet_id reste nullable : les événements liés à une fiche figurant
-- partagée (réponse à un message, compte candidat créé) n'ont pas de projet
-- unique et restent visibles par toute l'équipe, comme la fiche elle-même.
alter table public.notifications add column if not exists projet_id uuid references public.projets (id) on delete cascade;

create index if not exists notifications_projet_id_idx on public.notifications (projet_id);
