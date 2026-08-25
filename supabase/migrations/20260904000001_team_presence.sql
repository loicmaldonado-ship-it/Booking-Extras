-- Présence équipe : qui est connecté, avec sa photo — même principe que
-- figurants.last_seen_at (throttle applicatif dans getCurrentProfile()),
-- appliqué aux comptes chef·fe/assistant·e cette fois.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists avatar_storage_path text;

-- Bucket public : les avatars n'ont rien de confidentiel au sein de
-- l'équipe et c'est plus simple à afficher partout (Équipe, Admin) qu'avec
-- des URLs signées à renouveler.
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

create policy "public read profile avatars" on storage.objects
  for select using (bucket_id = 'profile-avatars');

create policy "authenticated upload profile avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'profile-avatars');

create policy "authenticated update profile avatars" on storage.objects
  for update to authenticated using (bucket_id = 'profile-avatars');

create policy "authenticated delete profile avatars" on storage.objects
  for delete to authenticated using (bucket_id = 'profile-avatars');
