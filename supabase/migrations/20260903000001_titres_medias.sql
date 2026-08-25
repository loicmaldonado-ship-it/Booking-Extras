-- Titre personnalisable sur un lien de partage (ex. "Casting — LD" ->
-- n'importe quel titre choisi par la chef·fe) — reste vide par défaut,
-- auquel cas la page affiche son titre générique habituel.
alter table public.partage_liens add column if not exists titre text;

-- Corps du mail d'invitation casting calibrable par rôle — vide par défaut,
-- auquel cas le corps généré automatiquement (voir inviteEmailBody) reste
-- utilisé tel quel.
alter table public.casting_roles add column if not exists message_corps text;

-- Photo de projet dédiée aux annonces (logo affiché sur /postuler),
-- volontairement distincte du logo des documents imprimés
-- (document_templates) : deux usages différents, deux images différentes.
alter table public.projets add column if not exists annonce_photo_storage_path text;

-- Moodboard : plusieurs photos par annonce, affichées aux candidat·es sur
-- la page de candidature publique.
create table public.annonce_photos (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index annonce_photos_annonce_id_idx on public.annonce_photos (annonce_id);

alter table public.annonce_photos enable row level security;
create policy "scoped by projet" on public.annonce_photos for all to authenticated
  using (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_photos.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  )
  with check (
    exists (
      select 1 from public.annonces
      where annonces.id = annonce_photos.annonce_id
        and public.has_projet_access(annonces.projet_id)
    )
  );
grant all on public.annonce_photos to service_role, authenticated;

-- Bucket public partagé pour le logo de projet (annonces) et le moodboard
-- (chemins préfixés projet/... et annonce/... pour les distinguer) — les
-- deux doivent être visibles sur /postuler, page publique sans session.
insert into storage.buckets (id, name, public)
values ('annonce-medias', 'annonce-medias', true)
on conflict (id) do nothing;

create policy "public read annonce medias" on storage.objects
  for select using (bucket_id = 'annonce-medias');

create policy "authenticated upload annonce medias" on storage.objects
  for insert to authenticated with check (bucket_id = 'annonce-medias');

create policy "authenticated update annonce medias" on storage.objects
  for update to authenticated using (bucket_id = 'annonce-medias');

create policy "authenticated delete annonce medias" on storage.objects
  for delete to authenticated using (bucket_id = 'annonce-medias');
