begin;

drop policy if exists "authenticated full access" on public.agents;
drop policy if exists "authenticated full access" on public.bareme_cachets;
drop policy if exists "authenticated full access" on public.bareme_majorations;
drop policy if exists "authenticated full access" on public.booking_indemnites;
drop policy if exists "authenticated full access" on public.booking_majorations;
drop policy if exists "authenticated full access" on public.candidature_onglets;
drop policy if exists "authenticated full access" on public.document_templates;
drop policy if exists "authenticated full access" on public.essayage_creneaux;
drop policy if exists "authenticated full access" on public.essayage_lieux;
drop policy if exists "authenticated full access" on public.figurant_indisponibilites;
drop policy if exists "authenticated full access" on public.notifications;
drop policy if exists "authenticated full access" on public.projet_indemnites;

revoke all on table
  public.agents,
  public.bareme_cachets,
  public.bareme_majorations,
  public.booking_indemnites,
  public.booking_majorations,
  public.candidature_onglets,
  public.document_templates,
  public.essayage_creneaux,
  public.essayage_lieux,
  public.figurant_indisponibilites,
  public.notifications,
  public.projet_indemnites
from public, anon, authenticated;

alter function public.set_updated_at()
  set search_path = pg_catalog;

alter function public.nom_onglet_journee(date)
  set search_path = pg_catalog;

drop policy if exists "authenticated upload document templates"
  on storage.objects;

drop policy if exists "authenticated update document templates"
  on storage.objects;

drop policy if exists "authenticated delete document templates"
  on storage.objects;

commit;