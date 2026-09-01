-- Mode de casting par défaut du rôle — indicatif seulement : les deux
-- façons d'envoyer une sélection (lien selftape par mail, ou planning
-- présentiel) restent toujours disponibles depuis la page, pour basculer
-- au cas par cas si une personne prévue en présentiel ne peut finalement
-- pas se déplacer. Défaut à 'selftape' pour matcher le fonctionnement
-- historique du casting (vidéo à distance).
alter table public.casting_roles add column if not exists mode text not null default 'selftape'
  check (mode in ('presentiel', 'selftape'));
