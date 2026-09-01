-- Nom de l'agence, en plus du nom/email/téléphone de l'agent déjà en place
-- — utile quand la personne connaît l'agence mais pas le nom de son contact
-- direct, ou pour retrouver vite tous les profils d'une même agence.
alter table public.figurants add column if not exists agent_agence text;

-- Tranche d'âge jouable (ex. "25-35 ans") — propre aux profils comédien·nes,
-- utile au casting pour filtrer d'un coup d'œil sans recalculer un âge
-- exact à partir de la date de naissance (souvent non connue précisément
-- pour un profil créé vite depuis un book/une fiche d'agence).
alter table public.figurants add column if not exists tranche_age text;

-- PDF joint automatiquement aux mails envoyés aux profils d'un rôle (ex.
-- extrait de script à préparer) — un fichier déjà prêt, uploadé une fois en
-- calibrant le rôle, pas une génération à la volée.
alter table public.casting_roles add column if not exists pdf_storage_path text;
alter table public.casting_roles add column if not exists pdf_filename text;

insert into storage.buckets (id, name, public)
values ('casting-role-documents', 'casting-role-documents', false)
on conflict (id) do nothing;

create policy "authenticated read casting role documents" on storage.objects
  for select to authenticated using (bucket_id = 'casting-role-documents');

create policy "authenticated upload casting role documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'casting-role-documents');

create policy "authenticated delete casting role documents" on storage.objects
  for delete to authenticated using (bucket_id = 'casting-role-documents');
