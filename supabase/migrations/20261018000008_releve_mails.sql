-- Relève automatique des réponses par mail dans la boîte d'envoi de chaque
-- projet (celle configurée par la cheffe). Le site retient où il en est
-- dans chaque boîte (dernier UID IMAP lu) au lieu de marquer les mails comme
-- lus : la cheffe garde ses mails non lus en gras dans Gmail.
create table if not exists public.boites_mail_releve (
  boite text primary key,
  uidvalidity bigint,
  dernier_uid bigint,
  releve_le timestamptz,
  erreur text
);

alter table public.boites_mail_releve enable row level security;
grant all on public.boites_mail_releve to service_role;

-- Identifiant du mail d'origine : une réponse n'est jamais importée deux fois.
alter table public.figurant_messages add column if not exists mail_message_id text;
create unique index if not exists figurant_messages_mail_message_id_idx
  on public.figurant_messages (mail_message_id) where mail_message_id is not null;
