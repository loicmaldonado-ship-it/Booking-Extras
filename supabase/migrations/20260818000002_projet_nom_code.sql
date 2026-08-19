-- Nom de code : quand un projet est confidentiel, ce nom remplace le nom
-- réel partout où il serait visible par des candidats/figurants externes
-- (annonce publique, messages, listing candidatures) au lieu du mot
-- générique "Confidentiel".

alter table public.projets add column if not exists nom_code text;
