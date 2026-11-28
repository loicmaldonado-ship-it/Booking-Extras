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

## Compléments (30/10/2026, même journée)
| Surface | Test | Résultat |
|---|---|---|
| Stockage (8 espaces) | `tests/storage-isolation-local.mjs` : lister / lire / signer / déposer / écraser / supprimer en anonyme et avec une session de cheffe | Espaces privés (photos, vidéos, documents de rôle, documents mineurs) : aucun accès. Espaces publics : **étaient listables par tous** → policies de listing retirées (`20261030170000_storage_public_sans_listing.sql`), fichiers toujours servis par URL publique, aucune écriture possible |
| Pages (127) | `tests/sec04-read-leak-pages.mjs` : cheffe d'une autre équipe et assistante hors projet, identifiants de A dans l'URL, projet_id/date/q, cookie de projet forgé | **Fuites corrigées** : listes de figurants de 7 pages (profil « ajout rapide » sans compte d'une autre équipe visible) → RLS ; cookie de projet courant forgé → contrôlé. PASS, et la cheffe A voit toujours ses profils |
| Actions serveur (244) | `tests/bug02-all-actions-cross-team.mjs` : écriture ET lecture (marqueur de A cherché dans chaque réponse) | PASS pour les deux acteurs |
| Barème | `tests/bareme-equipe-local.sql` | Barème par équipe, référence intacte |
| Création de comédien | relecture : `comedien_pool_id` posé à l'insertion (fiche, ajout rapide casting, inscription casting) | OK |
| Fiches historiques `comedien_pool_id IS NULL` | `tests/hotfix-rights-local.sql` | invisibles hors propriétaire globale (décision du hotfix) |

Publics par conception (non considérés comme fuites) : annonces ouvertes (titre, projet, cheffe) sur l'accueil, références de l'accueil, répertoire commun des agents (autocomplétion), base commune des figurants AVEC compte.

## Hors périmètre de ce script
- Actions serveur utilisant `service_role` (BUG-02) : la RLS ne les protège pas, elles doivent contrôler l'accès elles-mêmes.
- Propriétaire global (`is_owner`) et fiches historiques `comedien_pool_id IS NULL` : couverts par `tests/hotfix-rights-local.sql`, pas par ce script.
- `projets.gmail_smtp_app_password` reste lisible par les membres du même projet (pas de fuite inter-équipes) ; à restreindre aux colonnes si l'on veut le cacher aux assistantes.
