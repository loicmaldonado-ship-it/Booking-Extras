-- Catégorise chaque message interne pour que la fiche figurant et l'espace
-- candidat affichent des sections distinctes (Booking / Convocation /
-- Covoiturage / Essayage / Libre), et pour qu'on puisse y retrouver tout
-- échange même quand le contenu a été envoyé par SMS ou email.

alter table public.figurant_messages
  add column if not exists categorie text not null default 'libre'
  check (categorie in ('booking', 'convocation', 'covoiturage', 'essayage', 'libre'));

create index if not exists figurant_messages_categorie_idx on public.figurant_messages (categorie);
