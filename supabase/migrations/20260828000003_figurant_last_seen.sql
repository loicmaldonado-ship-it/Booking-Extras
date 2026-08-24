-- Dernière connexion à l'espace personnel (/compte) — affichée sur les
-- fiches figurant et candidature côté staff. Mise à jour par
-- getCurrentFigurant() à chaque session valide (avec throttle applicatif).

alter table public.figurants add column if not exists last_seen_at timestamptz;
