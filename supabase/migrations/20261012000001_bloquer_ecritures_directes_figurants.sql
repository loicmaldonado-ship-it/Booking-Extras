-- SECURITY/P0: close direct PostgREST writes to candidate data.
-- Historical policies let EVERY authenticated Supabase staff user INSERT,
-- UPDATE and DELETE arbitrary profiles and related data, across projects.
-- This first containment step does not alter intended SELECT behavior or
-- the separate candidate account system (service-role backed server actions).
-- Do NOT deploy to production without staging tests and authorization review.

begin;

-- Defence in depth: no direct table mutations with a public/ordinary JWT.
-- All current legitimate candidate/staff profile mutations are performed
-- through protected server actions using the backend service role.
revoke insert, update, delete on table
  public.figurants,
  public.figurant_photos,
  public.figurant_liens
from public, anon, authenticated;

-- Remove historical unconditional write policies. Even if a GRANT is
-- reintroduced accidentally, RLS continues to deny direct mutations.
drop policy if exists "figurants write" on public.figurants;
drop policy if exists "figurants update" on public.figurants;
drop policy if exists "figurants delete" on public.figurants;

-- The old ALL policy on these dependent tables also allowed unscoped
-- changes. Preserve the historical SELECT behavior for this first pass.
drop policy if exists "authenticated full access" on public.figurant_photos;
drop policy if exists "authenticated full access" on public.figurant_liens;

create policy "figurant photos read only" on public.figurant_photos
  for select to authenticated using (true);
create policy "figurant liens read only" on public.figurant_liens
  for select to authenticated using (true);

commit;
