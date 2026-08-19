-- Signature appliquée automatiquement aux messages (convocations, modèles)
-- et à l'annonce publique de ce projet.
alter table public.projets add column if not exists signature text;
