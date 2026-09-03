-- Date de fin optionnelle pour couvrir une période de tournage plutôt
-- qu'une date unique : cas fréquent où on annonce au candidat "un ou deux
-- jours de tournage entre le X et le Y" sans encore savoir la date précise.
-- Vide -> date unique (comportement actuel inchangé).
alter table public.casting_roles add column if not exists date_tournage_fin date;
