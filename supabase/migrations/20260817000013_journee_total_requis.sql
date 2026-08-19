-- Total journée : objectif global d'effectif défini manuellement par la
-- cheffe de casting, indépendant du détail par fonction (journee_besoins).

alter table public.journees add column if not exists total_requis integer;
