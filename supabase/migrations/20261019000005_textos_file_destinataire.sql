-- Textos envoyés depuis l'appli : on garde la figurant·e et le projet du
-- destinataire, pour ne remonter que les réponses à ces textos-là (jamais
-- un échange perso avec le même numéro). Les envois faits depuis l'iPhone
-- (raccourci) y sont aussi notés, directement en « envoye ».
alter table public.textos_file add column figurant_id uuid references public.figurants(id) on delete set null;
alter table public.textos_file add column projet_id uuid references public.projets(id) on delete set null;
create index textos_file_suivi_idx on public.textos_file (profile_id, statut, envoye_le);
