-- Numéro de costume attribué au premier essai (H01/F01/N01 selon le genre,
-- incrémenté par genre et par projet), affiché sur la fiche, les documents
-- et la convocation.

alter table public.essayages add column if not exists numero_costume text;
