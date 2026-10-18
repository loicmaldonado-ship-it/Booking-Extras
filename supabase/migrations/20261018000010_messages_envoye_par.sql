-- Qui, dans l'équipe, a envoyé chaque message (affiché « envoyé par … »
-- dans les conversations) : utile quand plusieurs personnes écrivent sur
-- le même projet.
alter table public.figurant_messages
  add column if not exists envoye_par uuid references public.profiles(id) on delete set null;
