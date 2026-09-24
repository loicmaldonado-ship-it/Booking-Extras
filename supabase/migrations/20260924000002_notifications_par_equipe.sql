-- Chaque équipe (les membres d'un projet) a ses propres notifications, et
-- les lit pour toute l'équipe. Les événements avec projet_id étaient déjà
-- limités à l'équipe du projet ; la fuite venait des "compte créé", sans
-- projet, donc visibles et marqués lus pour toutes les cheffes à la fois.
-- On les rattache au projet de la dernière candidature (ou du dernier
-- booking) de la personne.
update public.notifications n
set projet_id = coalesce(
  (select a.projet_id
     from public.candidatures c
     join public.annonces a on a.id = c.annonce_id
    where c.figurant_id = n.figurant_id
    order by c.created_at desc
    limit 1),
  (select b.projet_id
     from public.bookings b
    where b.figurant_id = n.figurant_id
    order by b.created_at desc
    limit 1)
)
where n.type = 'compte_cree' and n.projet_id is null and n.figurant_id is not null;

-- Annonce concernée, pour regrouper les candidatures par annonce dans la
-- cloche ("5 nouvelles candidatures · Figuration Adelphes").
alter table public.notifications
  add column if not exists annonce_id uuid references public.annonces (id) on delete cascade;

update public.notifications n
set annonce_id = c.annonce_id
from public.candidatures c
where n.type = 'candidature' and n.annonce_id is null and n.lien = '/candidatures/' || c.id;
