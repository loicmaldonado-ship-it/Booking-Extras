-- L'agent est finalement rattaché à la fiche figurant (figurants.agent_*),
-- pas à une entrée de casting précise — colonnes jamais utilisées en
-- production, sans risque à retirer.
alter table public.casting_entries
  drop column if exists agent_nom,
  drop column if exists agent_email,
  drop column if exists agent_telephone;
