-- Questions d'un rôle de casting (oui / non, précision facultative), posées
-- sur la page d'envoi des photos / vidéos. Les réponses gardent le texte
-- de la question au moment de la réponse (modifier la question ensuite ne
-- change pas ce qui a été répondu).
alter table public.casting_roles add column if not exists questions text[] not null default '{}';
alter table public.casting_entries add column if not exists reponses jsonb not null default '[]'::jsonb;
