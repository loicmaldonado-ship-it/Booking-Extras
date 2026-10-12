-- SECURITY/P0: Restrict metadata reads to figurants visible under the current
-- public.figurants RLS policy; remove unscoped direct authenticated access to
-- the private figurant-photos Storage bucket.
--
-- NOTE: Generic non-comedian profiles are currently shared between teams by
-- business decision (existing figurants RLS). This migration deliberately
-- preserves that behavior. Project-specific photos remain project-scoped.
--
-- Existing server-side service_role uploads, deletes and signed URL creation
-- bypass ordinary user policies; retest candidate, staff, casting, fitting and
-- signed-upload flows after applying this migration on a local database.
-- Never apply this patch to production without a dedicated release review.

begin;

-- Under the current RLS of public.figurants, the subquery below only sees
-- profiles the logged-in staff member is permitted to see. No SECURITY
-- DEFINER helper is involved, so restricted pools remain restricted.
drop policy if exists "figurant photos read only" on public.figurant_photos;
create policy "figurant photos scoped read" on public.figurant_photos
  for select to authenticated
  using (
    exists (
      select 1
      from public.figurants f
      where f.id = figurant_photos.figurant_id
    )
    and (
      projet_id is null
      or public.has_projet_access(projet_id)
    )
  );

drop policy if exists "figurant liens read only" on public.figurant_liens;
create policy "figurant liens scoped read" on public.figurant_liens
  for select to authenticated
  using (
    exists (
      select 1
      from public.figurants f
      where f.id = figurant_liens.figurant_id
    )
  );

-- A private bucket alone does not stop authenticated direct reads or writes.
-- The four historical policies were not scoped by project, owner or path.
-- Access to these objects must go through authorized server actions and
-- short-lived signed URLs; do NOT remove policies for other Storage buckets.
drop policy if exists "authenticated read figurant photos" on storage.objects;
drop policy if exists "authenticated upload figurant photos" on storage.objects;
drop policy if exists "authenticated update figurant photos" on storage.objects;
drop policy if exists "authenticated delete figurant photos" on storage.objects;

commit;
