-- SECURITY: Remove unscoped direct authenticated access to project media.
-- All reviewed application write paths for these buckets use an authorized
-- server action and the Supabase service role. Casting video clients use
-- short-lived signed upload tokens issued by such actions.
--
-- Keep PUBLIC READ on the genuinely public buckets (annonce-medias,
-- document-templates used for shared logos, and profile-avatars). Changing
-- their visibility needs a separate product decision and URL migration.
-- Keep references-affiches policies unchanged (public image assets).
--
-- IMPORTANT: Retest self-tape signed uploads, staff video replacements,
-- casting-role PDFs, project document logos, announcement images and
-- team avatars after applying locally. Do not deploy without staging tests.

begin;

-- Private casting videos: deny direct authenticated download/upload/delete.
-- Authorized server-side signed read/upload flows remain available.
drop policy if exists "authenticated read casting videos" on storage.objects;
drop policy if exists "authenticated upload casting videos" on storage.objects;
drop policy if exists "authenticated delete casting videos" on storage.objects;

-- Private casting role PDFs: do not expose PDFs across projects.
drop policy if exists "authenticated read casting role documents" on storage.objects;
drop policy if exists "authenticated upload casting role documents" on storage.objects;
drop policy if exists "authenticated delete casting role documents" on storage.objects;

-- Public announcement images: keep public read, remove unscoped writes.
drop policy if exists "authenticated upload annonce medias" on storage.objects;
drop policy if exists "authenticated update annonce medias" on storage.objects;
drop policy if exists "authenticated delete annonce medias" on storage.objects;

-- Public project document logos: keep public read on share pages.
drop policy if exists "authenticated upload document templates" on storage.objects;
drop policy if exists "authenticated update document templates" on storage.objects;
drop policy if exists "authenticated delete document templates" on storage.objects;

-- Public team avatars: keep public read; only server action may write.
drop policy if exists "authenticated upload profile avatars" on storage.objects;
drop policy if exists "authenticated update profile avatars" on storage.objects;
drop policy if exists "authenticated delete profile avatars" on storage.objects;

commit;
