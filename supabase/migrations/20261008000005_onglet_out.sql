-- « OUT BE » devient « OUT » : les candidatures rangées là disparaissent de
-- l'annonce (sauf dans l'onglet OUT) et reçoivent un message dans leur
-- espace (« non retenu·e »), une seule fois par candidature.
update public.candidature_onglets set nom = 'OUT' where fixe and nom = 'OUT BE';

alter table public.figurant_messages drop constraint if exists figurant_messages_categorie_check;
alter table public.figurant_messages add constraint figurant_messages_categorie_check
  check (categorie in ('booking', 'convocation', 'covoiturage', 'essayage', 'casting', 'hmc', 'libre', 'espace_perso', 'non_retenu'));

-- Candidature concernée par un message (message « non retenu·e », retiré si
-- la candidature sort de OUT).
alter table public.figurant_messages
  add column if not exists candidature_id uuid references public.candidatures (id) on delete set null;
create index if not exists figurant_messages_candidature_id_idx on public.figurant_messages (candidature_id);
