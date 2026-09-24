-- Onglets de rangement propres à une annonce : ceux créés à la main
-- ("Ok dispo le 26/06"...) n'apparaissent plus chez toutes les cheffes et
-- sur toutes les annonces. annonce_id null = onglet commun (Retenu,
-- Peut-être, Ok dispo, OUT BE), visible partout comme avant.
alter table public.candidature_onglets
  add column if not exists annonce_id uuid references public.annonces (id) on delete cascade;

create index if not exists candidature_onglets_annonce_id_idx on public.candidature_onglets (annonce_id);
