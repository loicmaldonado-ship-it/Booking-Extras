-- Barème ACFDA (grille résumé des salaires, conventions Cinéma / Audiovisuelle,
-- au 1er juin 2026 — cf. document fourni par l'utilisateur). Sert de référence
-- pour les cachets ; le calcul complet (application aux heures/conditions
-- réelles d'un booking) est construit avec la section Bookings.
--
-- Certaines valeurs de la grille résumé sont ambiguës sans lecture des
-- conventions collectives complètes (la grille le précise elle-même : "ne
-- remplace pas la lecture des CC"). Notamment le tarif "figurant" standard en
-- Audiovisuelle n'apparaît que comme "à défaut : mini SMIC" — on le seed tel
-- quel, à vérifier/corriger par l'utilisateur si besoin.

-- Convention applicable au projet : détermine quelle grille de tarifs utiliser.
alter table public.projets
  add column if not exists convention text check (convention in ('Cinéma', 'Audiovisuelle'));

-- Élargir "cachet" aux vraies catégories de la grille (pas juste Silhouette/Rôle).
alter table public.candidatures drop constraint if exists candidatures_cachet_assigne_check;
alter table public.candidatures
  add constraint candidatures_cachet_assigne_check
  check (cachet_assigne in ('Figurant', 'Silhouette', 'Silhouette parlante', 'Doublure simple', 'Doublure polyvalente', 'Rôle'));

alter table public.bookings drop constraint if exists bookings_cachet_check;
alter table public.bookings
  add constraint bookings_cachet_check
  check (cachet in ('Figurant', 'Silhouette', 'Silhouette parlante', 'Doublure simple', 'Doublure polyvalente', 'Rôle'));

-- Tarifs de base par cachet et par convention.
create table if not exists public.bareme_cachets (
  id uuid primary key default gen_random_uuid(),
  convention text not null check (convention in ('Cinéma', 'Audiovisuelle')),
  cachet text not null check (cachet in ('Figurant', 'Silhouette', 'Silhouette parlante', 'Doublure simple', 'Doublure polyvalente', 'Rôle')),
  montant_brut numeric(8,2) not null,
  date_effet date not null default '2026-06-01',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (convention, cachet, date_effet)
);

drop trigger if exists bareme_cachets_set_updated_at on public.bareme_cachets;
create trigger bareme_cachets_set_updated_at
  before update on public.bareme_cachets
  for each row execute function public.set_updated_at();

-- Majorations (heures sup, nuit, dimanche, fériés, indemnités diverses).
create table if not exists public.bareme_majorations (
  id uuid primary key default gen_random_uuid(),
  convention text not null check (convention in ('Cinéma', 'Audiovisuelle')),
  type text not null,
  label text not null,
  valeur_type text not null check (valeur_type in ('pourcentage', 'montant_fixe', 'cachet_double', 'pourcentage_remuneration', 'pourcentage_salaire_jour')),
  valeur numeric(8,2),
  cinema_uniquement boolean not null default false,
  notes text,
  date_effet date not null default '2026-06-01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bareme_majorations_set_updated_at on public.bareme_majorations;
create trigger bareme_majorations_set_updated_at
  before update on public.bareme_majorations
  for each row execute function public.set_updated_at();

alter table public.bareme_cachets enable row level security;
alter table public.bareme_majorations enable row level security;

create policy "authenticated full access" on public.bareme_cachets
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.bareme_majorations
  for all to authenticated using (true) with check (true);

grant all on public.bareme_cachets to service_role, authenticated;
grant all on public.bareme_majorations to service_role, authenticated;

-- Seed : cachets de base
insert into public.bareme_cachets (convention, cachet, montant_brut, notes) values
  ('Cinéma', 'Figurant', 108.33, '8h × 12,31€ + 10% prime précarité ; à défaut mini SMIC 98,48€ si supérieur'),
  ('Cinéma', 'Silhouette', 150.04, null),
  ('Cinéma', 'Silhouette parlante', 250.01, 'jusqu''à 5 mots'),
  ('Cinéma', 'Doublure simple', 165.00, null),
  ('Cinéma', 'Doublure polyvalente', 200.02, null),
  ('Cinéma', 'Rôle', 418.25, 'pour mémoire — hors figuration'),
  ('Audiovisuelle', 'Figurant', 98.48, 'mini SMIC "à défaut" selon la grille résumé — à vérifier auprès de la CC complète'),
  ('Audiovisuelle', 'Doublure simple', 122.00, 'la grille résumé ne distingue pas simple/polyvalente en Audiovisuelle'),
  ('Audiovisuelle', 'Rôle', 304.99, 'pour mémoire — hors figuration')
on conflict (convention, cachet, date_effet) do nothing;

-- Seed : majorations Cinéma
insert into public.bareme_majorations (convention, type, label, valeur_type, valeur, cinema_uniquement, notes) values
  ('Cinéma', 'heures_sup_9_10', 'Heures supplémentaires — 9ème et 10ème heures', 'pourcentage', 25, false, null),
  ('Cinéma', 'heures_sup_11_12', 'Heures supplémentaires — 11ème et 12ème heures', 'pourcentage', 50, false, null),
  ('Cinéma', 'nuit_1_8h', 'Heures de nuit — 8 premières heures', 'pourcentage', 50, false, '1/04-30/09 : 22h-6h ; 1/10-31/03 : 20h-6h (sauf studio 21h-6h)'),
  ('Cinéma', 'nuit_9h_plus', 'Heures de nuit — à partir de la 9ème heure', 'pourcentage', 100, false, null),
  ('Cinéma', 'dimanche', 'Dimanche', 'cachet_double', null, false, null),
  ('Cinéma', 'premier_mai', '1er mai', 'cachet_double', null, false, 'hors limite de cumul 200%'),
  ('Cinéma', 'jour_ferie', 'Jours fériés (1/01, 14/07, 15/08, 1/11, 11/11, 25/12)', 'cachet_double', null, false, null),
  ('Cinéma', 'paques_ascension', 'Lundi de Pâques (08/05) et Jeudi de l''Ascension', 'cachet_double', null, false, null),
  ('Cinéma', 'cumul_limite', 'Cumul des majorations', 'pourcentage', 200, false, 'limité à 200%, sauf 1er mai'),
  ('Cinéma', 'transport', 'Indemnité transport en commun', 'montant_fixe', null, false, 'accord préalable de la production requis'),
  ('Cinéma', 'costume_uniforme', 'Costume spécial fourni par le figurant — uniforme', 'montant_fixe', 70, false, null),
  ('Cinéma', 'costume_smoking', 'Costume spécial fourni par le figurant — smoking / robe de soirée', 'montant_fixe', 95, false, null),
  ('Cinéma', 'essayage', 'Indemnité essayage', 'montant_fixe', 25.00, false, null),
  ('Cinéma', 'repas', 'Indemnité repas', 'montant_fixe', 21.40, false, null),
  ('Cinéma', 'semaine_5j', 'Engagement à la semaine — 5 jours (40h)', 'montant_fixe', 501.60, false, null),
  ('Cinéma', 'semaine_6j', 'Engagement à la semaine — 6 jours (48h)', 'montant_fixe', 623.20, false, null),
  ('Cinéma', 'danse_chant', 'Scène danse et/ou chant', 'montant_fixe', 25, true, null),
  ('Cinéma', 'repetition_danse_chant', 'Répétition danse/chant', 'pourcentage_salaire_jour', 50, true, null),
  ('Cinéma', 'pluie_natation', 'Pluie / natation', 'montant_fixe', 15, true, null),
  ('Cinéma', 'nu', 'Topless / cadavre / nu', 'montant_fixe', 50, true, null),
  ('Cinéma', 'scene_penible', 'Scène particulièrement pénible', 'montant_fixe', 20, true, null),
  ('Cinéma', 'animaux_accessoires', 'Animaux / accessoires professionnels / véhicules sans permis', 'montant_fixe', 25, true, null),
  ('Cinéma', 'vehicule_permis', 'Véhicule avec permis (hors carburant)', 'montant_fixe', 35, true, null);

-- Seed : majorations Audiovisuelle
insert into public.bareme_majorations (convention, type, label, valeur_type, valeur, cinema_uniquement, notes) values
  ('Audiovisuelle', 'heures_sup_9_10_11', 'Heures supplémentaires — 9ème, 10ème et 11ème heures', 'pourcentage', 25, false, null),
  ('Audiovisuelle', 'heures_sup_12', 'Heures supplémentaires — 12ème heure', 'pourcentage', 50, false, null),
  ('Audiovisuelle', 'nuit', 'Heures de nuit (par heure)', 'pourcentage', 25, false, '21 déc-20 mars : 20h-6h ; reste de l''année : 22h-7h'),
  ('Audiovisuelle', 'dimanche', 'Dimanche', 'pourcentage', 50, false, 'majoration par heure travaillée'),
  ('Audiovisuelle', 'premier_mai', '1er mai', 'pourcentage_remuneration', 300, false, null),
  ('Audiovisuelle', 'jour_ferie', 'Jours fériés (1/01, 14/07, 15/08, 1/11, 11/11, 25/12)', 'pourcentage_remuneration', 200, false, null),
  ('Audiovisuelle', 'paques_ascension', 'Lundi de Pâques (08/05) et Jeudi de l''Ascension', 'pourcentage_remuneration', 150, false, null),
  ('Audiovisuelle', 'transport', 'Indemnité transport en commun', 'pourcentage', 50, false, '50% des frais réels engagés'),
  ('Audiovisuelle', 'costume', 'Figuration en costumes spéciaux fournis par le figurant', 'montant_fixe', 47.05, false, null),
  ('Audiovisuelle', 'essayage', 'Indemnité essayage', 'montant_fixe', 15.53, false, null),
  ('Audiovisuelle', 'semaine', 'Engagement à la semaine', 'pourcentage_salaire_jour', 450, false, '4,5 × salaire journalier, ne peut pas être inférieur au SMIC'),
  ('Audiovisuelle', 'silhouette_parlante', 'Majoration silhouette — muette et jusqu''à 2 répliques', 'montant_fixe', 42.24, false, null);
