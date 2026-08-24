-- Un lieu d'essayage a un nom (déjà "lieu") et une adresse — pour que le
-- message envoyé lise "RDV à 14h à Eurocostume, 12 rue X" plutôt que juste
-- un texte libre. Le lieu se calibre par projet (voir essayage_lieux),
-- avec possibilité de changer le lieu pour une personne précise
-- (essayages.lieu existait déjà mais n'était pas exploité comme override
-- individuel — on l'active ici, avec son pendant adresse).

alter table public.essayages
  add column if not exists adresse text;
