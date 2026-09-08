-- Un·e comédien·ne peut aussi faire de la figuration : sa fiche comédien·ne
-- (privée, gérée par un pool précis) et une éventuelle fiche figurant·e
-- (publique, partagée) sont volontairement deux profils distincts, même
-- avec le même email — pas un doublon à fusionner. L'ancienne contrainte
-- (un seul email dans toute la table) bloquait la création de la seconde
-- fiche pour n'importe quelle chef·fe qui ne voit pas la première (hors du
-- pool). Un même email reste unique PAR type (impossible d'avoir deux
-- fiches figurant·e, ou deux fiches comédien·ne, avec le même email).
drop index if exists public.figurants_email_unique_idx;
create unique index figurants_email_unique_idx
  on public.figurants (lower(email), est_comedien)
  where email is not null;
