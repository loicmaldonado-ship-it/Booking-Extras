# Isolation inter-équipes — audit base du 30 octobre 2026 (SEC-03 / SEC-04)

Base Supabase locale neuve (183 migrations + seed), données fictives, tout annulé en fin de script.
Script : `tests/cross-team-isolation-local.sql`.

## Méthode
Deux équipes A et B, chacune avec une cheffe (non propriétaire globale), une assistante membre du projet,
un projet et une ligne dans chacune des 30 tables accessibles au rôle `authenticated`.
Pour chaque acteur (4) et chaque table (30) : SELECT, UPDATE et DELETE avec un JWT `authenticated`
et une session staff valide, sur les lignes de l'autre équipe ; contrôle inverse que ses propres lignes restent visibles.

## Résultats
| Table(s) | Lecture étrangère | Écriture/suppression étrangère | Statut |
|---|---|---|---|
| projets, annonces (+dates, questions, photos), candidatures (+jours, disponibilités, réponses, étiquettes, liens), journées, besoins, bookings, réserve, casting (rôles, entrées, événements d'upload, présentiel journées/créneaux/entrées), essayages (+journées), partage_liens, partage_journee_liens, figurants, figurant_photos, figurant_liens | 0 | 0 | OK |
| projet_membres | **cheffes : visible** (avant) → 0 (après) | 0 | **Corrigé** : migration `20261030141000_isoler_lecture_projet_membres.sql` |
| profiles — colonne `gmail_smtp_app_password` | **lisible par tout membre d'équipe** (avant) → refusée (après) | 0 | **Corrigé** : report du hotfix `423751b` absent de la branche de tests, migration `20261030140000_report_hotfix_secret_smtp_profiles.sql` |
| profiles — nom, email, téléphone, rôle | **visible par tout le personnel** (avant) → son profil + personnes partageant un projet + propriétaire globale (après) | 0 | **Corrigé** (décision DEC-02 validée par Maxime le 30/10) : migration `20261030143000_isoler_lecture_profiles_equipe.sql` ; `tests/hotfix-rights-local.sql` mis à jour en conséquence |

Accès légitimes : aucun acteur n'a perdu l'accès à ses propres lignes.

## Hors périmètre de ce script
- Objets Storage (buckets) : non couverts.
- Actions serveur utilisant `service_role` (BUG-02) : la RLS ne les protège pas, elles doivent contrôler l'accès elles-mêmes.
- Propriétaire global (`is_owner`) et fiches historiques `comedien_pool_id IS NULL` : couverts par `tests/hotfix-rights-local.sql`, pas par ce script.
- `projets.gmail_smtp_app_password` reste lisible par les membres du même projet (pas de fuite inter-équipes) ; à restreindre aux colonnes si l'on veut le cacher aux assistantes.
