-- Deux groupes de chef·fes isolés (pools comédien·nes différents) doivent
-- pouvoir avoir chacun leur propre fiche comédien·ne pour la même personne
-- (même email) sans se bloquer mutuellement — la contrainte précédente
-- (unique par email+type, sans notion de pool) l'en empêchait. Remplacée
-- par deux index séparés : figurant·e reste unique par email dans toute la
-- table (jamais scindé par pool, toujours partagé) ; comédien·ne devient
-- unique par email PAR pool (coalesce sur son propre id si sans pool —
-- cas marginal, juste pour rester unique face à lui-même).
drop index if exists public.figurants_email_unique_idx;

create unique index figurants_email_unique_figurant_idx
  on public.figurants (lower(email))
  where email is not null and est_comedien = false;

create unique index figurants_email_unique_comedien_idx
  on public.figurants (lower(email), coalesce(comedien_pool_id, id))
  where email is not null and est_comedien = true;
