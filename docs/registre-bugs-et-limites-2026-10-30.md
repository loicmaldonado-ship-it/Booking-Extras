# Registre des bugs de reprise et limites connues (ENV-05 / REL-06 / ENV-04 — 30/10/2026)

## 1. Bugs trouvés et corrigés pendant la reprise du 30/10 (branche de tests)
| # | Bug (reproduit) | Carte | Correctif |
|---|---|---|---|
| 1 | Mot de passe Gmail (chiffré) des cheffes lisible par tout membre d'équipe : hotfix 423751b jamais reporté | SEC-03 | migration `20261030140000` |
| 2 | Composition des équipes de tous les projets visible par toute cheffe | SEC-03 | `20261030141000` |
| 3 | Nom, email, téléphone du personnel visibles par les autres équipes | DEC-02 / SEC-03 | `20261030143000` |
| 4 | `upsertAgent` appelable par tout membre d'équipe (écrasement du répertoire commun) | BUG-02 | `src/lib/agents/upsert.ts` |
| 5 | Barème commun modifiable/supprimable par n'importe quelle cheffe | BUG-02 | barème par équipe, `20261030160000` |
| 6 | `removeMajorationFromBooking` supprimait sans contrôle si le booking était illisible | BUG-02 | actions barème |
| 7 | Profil « ajout rapide » sans compte d'une équipe visible dans les listes des autres équipes (7 pages) | CAN-02 / SEC-04 | listes via RLS |
| 8 | Cookie de projet courant forgé → nom du projet d'une autre équipe affiché | SEC-04 | `getCurrentProjetId` |
| 9 | Espaces de stockage publics listables par n'importe qui | SEC-03 | `20261030170000` |
| 10 | Une candidate ne pouvait jamais redéfinir son mot de passe (action non branchée) | SEC-02 | formulaire sur /compte |
| 11 | Requêtes > 10 Mo coupées : photos de 10–20 Mo en échec, erreur serveur au lieu d'un message | BUG-11 / MED-03 | `proxyClientMaxBodySize` |

## 2. Smoke test des écrans (ENV-04)
Appli construite (`npm start`), base locale neuve, 3 rôles fictifs.
| Écran | Cheffe | Assistante | Candidate | État |
|---|---|---|---|---|
| Accueil, projets, annonces, candidatures, bookings, casting, essayages, figurants, équipe, barème, modèles, mineurs, mon compte, aide | OK | OK (sections de son périmètre) | — | OK |
| /compte, /postuler/[token] | — | — | OK | OK |
| 127 pages staff (toutes routes, identifiants d'une autre équipe) | aucune fuite après correctifs | aucune fuite | — | OK |
| Avatar de la cheffe du seed | image absente du stockage local (donnée de démo) | | | sans impact |
Les parcours de modification complets relèvent des cartes MET-xx (recette métier).

## 3. Ce qui est fiable aujourd'hui (vérifié par tests automatisés réels)
Isolation entre équipes (base, stockage, pages, actions serveur), authentification candidate et équipe (énumération,
limitation, sessions, liens à usage unique, récupération), validation des fichiers envoyés, liens publics, barème par
équipe, doublons à l'inscription. Commande : `bash scripts/integration-tests.sh` (et job CI `integration`).

## 4. Limites connues / hors périmètre volontaire
- **Non vérifié en production** : aucune action sur la prod, ni sur Vercel/Supabase de production (variables, sauvegardes).
- **Recette métier** (MET-xx, CAN-05/06/07/09, LEG-xx, COM-xx, QA-06) : à faire par Loïc et Mathieu ; les tests techniques ne la remplacent pas.
- **Envois réels** (emails, SMS, push) : bloqués en mode test ; non validés de bout en bout.
- **Vercel ~4,5 Mo par requête** : dépend de la compression d'images côté navigateur (MED-01).
- **Médias annulés en cours d'envoi** : un fichier déjà transféré peut rester orphelin dans le stockage (MED-03).
- **Lien de partage d'un projet archivé** : reste accessible (cohérent avec MET-01, à confirmer).
- **`tests/rgpd-snapshot-local.sql`** dépend d'identifiants de l'ancienne base de recette ; non exécuté par la batterie.
- **Hors périmètre (V2 / décisions à prendre)** : abonnement payant (A&A-01), fonctions d'administration et signature
  électronique (RV2-1/2/3), nouveau logo.
