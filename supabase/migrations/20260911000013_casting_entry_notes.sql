-- Notes libres sur un profil de casting (spécificités repérées : "sourire
-- parfait", "préfère un créneau tôt", "allergie X"...) — casting_presentiel
-- avait déjà sa colonne notes (jamais branchée côté UI), casting_entries
-- (rôles selftape/présentiel) ne l'avait pas du tout.
alter table public.casting_entries add column if not exists notes text;
