-- Modèle de document par projet : logo + couleur d'accent, repris
-- automatiquement sur l'entête (DocumentLetterhead) de tous les documents
-- générés (trombis, fiches, bordereau, silhouettes...) — un seul réglage
-- s'applique partout, pas de config à dupliquer document par document.
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null unique references public.projets (id) on delete cascade,
  logo_storage_path text,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_templates enable row level security;

create policy "authenticated full access" on public.document_templates
  for all to authenticated using (true) with check (true);

grant all on public.document_templates to service_role, authenticated;

-- Bucket public : le logo apparaît aussi sur les pages /partage publiques
-- (costumière, réal...) qui n'ont pas de session authentifiée.
insert into storage.buckets (id, name, public)
values ('document-templates', 'document-templates', true)
on conflict (id) do nothing;

create policy "public read document templates" on storage.objects
  for select using (bucket_id = 'document-templates');

create policy "authenticated upload document templates" on storage.objects
  for insert to authenticated with check (bucket_id = 'document-templates');

create policy "authenticated update document templates" on storage.objects
  for update to authenticated using (bucket_id = 'document-templates');

create policy "authenticated delete document templates" on storage.objects
  for delete to authenticated using (bucket_id = 'document-templates');
