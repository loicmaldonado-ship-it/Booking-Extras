-- SEC-03 : la policy « select own or chef » laissait toute cheffe lire la composition
-- des équipes de TOUS les projets (projet_id + profile_id des assistantes d'autres cheffes).
-- Constat reproduit le 30/10/2026 par tests/cross-team-isolation-local.sql.
-- Nouvelle règle : sa propre ligne, ou les membres d'un projet auquel on a accès
-- (has_projet_access est SECURITY DEFINER : pas de récursion RLS). Le propriétaire global
-- garde l'accès via is_owner() dans has_projet_access. Les écrans équipe/présence lisent via
-- service_role et filtrent déjà par projets accessibles : aucun changement fonctionnel attendu.
begin;
drop policy if exists "select own or chef" on public.projet_membres;
drop policy if exists "select own or accessible project" on public.projet_membres;
create policy "select own or accessible project" on public.projet_membres
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_projet_access(projet_id));
commit;
