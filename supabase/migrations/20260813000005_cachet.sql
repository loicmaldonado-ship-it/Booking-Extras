-- Le brief mélangeait deux notions distinctes sous "fonction" :
--   - la fonction : ce que la personne joue dans la scène (passant, boulangère...) — texte libre
--   - le cachet : la catégorie de paie/contrat (silhouette ou rôle) — valeur fixe
-- On les sépare : fonction reste du texte libre, cachet devient son propre champ.

alter table public.candidatures
  add column if not exists cachet_assigne text check (cachet_assigne in ('Silhouette', 'Rôle'));

alter table public.bookings
  add column if not exists cachet text check (cachet in ('Silhouette', 'Rôle'));
