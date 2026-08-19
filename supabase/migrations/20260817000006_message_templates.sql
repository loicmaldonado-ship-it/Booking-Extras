-- Modèles de messages réutilisables (convocation personnalisée, relance,
-- annulation...). Le corps peut contenir le token {prenom}, remplacé par le
-- vrai prénom du figurant au moment de l'envoi.
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  sujet text not null,
  corps text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists message_templates_set_updated_at on public.message_templates;
create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;

create policy "authenticated full access" on public.message_templates
  for all to authenticated using (true) with check (true);

grant all on public.message_templates to service_role, authenticated;
