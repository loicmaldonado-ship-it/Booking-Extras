-- Trace chaque tentative d'envoi vidéo (candidat·e OU équipe) — pas pour
-- l'analytique, mais pour ne plus repartir de zéro quand quelqu'un signale
-- "ça marche pas" sans aucun détail. Insertion "fire-and-forget" côté
-- application (un échec d'enregistrement ne doit jamais faire échouer
-- l'envoi réel) — voir logCastingUploadEvent dans upload-actions.ts.
create table public.casting_upload_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.casting_entries (id) on delete cascade,
  projet_id uuid not null references public.projets (id) on delete cascade,
  source text not null check (source in ('candidat', 'equipe')),
  kind text not null check (kind in ('video', 'photo')),
  outcome text not null check (outcome in ('reussi', 'repli_original', 'erreur', 'annule')),
  error_message text,
  original_bytes bigint,
  final_bytes bigint,
  duration_ms integer,
  user_agent text,
  created_at timestamptz not null default now()
);

create index casting_upload_events_entry_id_idx on public.casting_upload_events (entry_id);
create index casting_upload_events_projet_id_idx on public.casting_upload_events (projet_id);
create index casting_upload_events_created_at_idx on public.casting_upload_events (created_at desc);

alter table public.casting_upload_events enable row level security;
create policy "scoped by projet" on public.casting_upload_events for all to authenticated
  using (public.has_projet_access(projet_id)) with check (public.has_projet_access(projet_id));
grant all on public.casting_upload_events to service_role, authenticated;
