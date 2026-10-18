-- Remontée des réponses texto par le relais Mac : il lit les messages reçus
-- dans l'app Messages (numéros à qui le site a écrit uniquement) et les
-- envoie au site. État de cette remontée, affiché dans Mon compte → Textos.
alter table public.relais_textos add column if not exists reponses_le timestamptz;
alter table public.relais_textos add column if not exists reponses_erreur text;
