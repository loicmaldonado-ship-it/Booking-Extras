-- Statut de suivi sur une entrée de casting, même progression que les
-- bookings (proposé -> envoyé -> ... -> validé -> confirmé, indisponible/
-- annulé possibles à tout moment) — pour suivre l'avancement d'un
-- comédien·ne dans le process, pas juste "envoyé/pas envoyé".
alter table public.casting_entries
  add column if not exists statut text not null default 'proposé'
  check (statut in ('proposé', 'envoyé', 'a_relancer', 'doit_rappeler', 'attente_validation', 'valide', 'confirmé', 'indisponible', 'annulé'));

create index if not exists casting_entries_statut_idx on public.casting_entries (statut);
