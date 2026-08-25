-- Les messages envoyés avant le cloisonnement (20260907/08) ont projet_id
-- nul, donc traités comme "visibles par toute l'équipe" par le nouveau
-- filtre — un vrai souci pour l'historique déjà lié à un booking précis.
-- On rattache rétroactivement ceux qui référencent un booking (convocation,
-- booking, covoiturage, espace_perso) à son projet. Les messages sans
-- booking_id (candidature libre, casting) ne peuvent pas être rattachés de
-- façon fiable après coup et restent visibles par tous, comme avant.
update public.figurant_messages fm
set projet_id = b.projet_id
from public.bookings b
where fm.booking_id = b.id
  and fm.projet_id is null;

-- Idem pour les messages de casting sans booking : rattachés seulement si
-- le figurant n'a de fiche casting que sur UN seul projet (cas non ambigu)
-- — sinon on ne peut pas deviner lequel de façon fiable.
update public.figurant_messages fm
set projet_id = ce.only_projet_id
from (
  select figurant_id, (array_agg(distinct projet_id))[1] as only_projet_id
  from public.casting_entries
  group by figurant_id
  having count(distinct projet_id) = 1
) ce
where fm.figurant_id = ce.figurant_id
  and fm.categorie = 'casting'
  and fm.projet_id is null;
