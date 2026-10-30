# Comptes rendus des cartes Trello restantes (30/10/2026)

**Postés sur Trello le 30/10/2026 vers 18 h** (autorisation de l'utilisateur) : 30 cartes commentées et cochées,
7 commentées sans coche (COM-03, COM-05, LEG-06, REL-01/02/03/05). Logo, A&A-01 et RV2-1/2/3 laissées de côté (consigne).

Environnement de toutes les vérifications : base Supabase locale, données fictives, appli construite (`npm start`), emails
capturés par Mailpit (aucun envoi réel), Chromium (Playwright). Commande qui rejoue tout : `bash scripts/integration-tests.sh`
(sections « Validations » de `WORK_PROGRESS.md`). Branche `tests/integration-main-elea-2026-10-22`.

Légende : **Cocher** = technique faite ; **Ne pas cocher** = travail restant hors de portée de la reprise.

## Candidates

**CAN-05 — Formulaire de candidature complet.** Cocher.
Vérifié : `bug11-upload-validation` (photos et PDF : faux fichiers refusés, vrais acceptés, 20 Mo max avec message clair),
`can03-doublons-local` (inscription réelle avec photos ; doublons email/nom+téléphone), `qa06-mobile-a11y` (/postuler
à 375 px, champs nommés), suites SQL âge/mineurs. Reste : recette métier des annonces paramétrées (questions, dates,
conditions mineur, bande démo) — **Loïc et Mathieu**.

**CAN-06 — Espace candidate par projet.** Cocher.
Vérifié : `recette-technique-e2e` (candidature et booking du projet visibles sur /compte), `auth-e2e-local` (cloisonnement
messages/photos/indisponibilités entre candidates), `med01` (ajout de photos réel), formulaire mot de passe ajouté.
Reste : recette métier sur téléphone — **Loïc et Mathieu**.

**CAN-07 — Échanges candidate ↔ équipe.** Cocher.
Vérifié : convocation reçue dans l'espace candidate, accusé « bien reçu » enregistré (`recette-technique-e2e`) ; sans
boîte d'envoi configurée, le message est gardé et l'échec email signalé. Reste : réponses par email réelles (relève
Gmail) — **Loïc** en préproduction.

**CAN-09 — Création, activation, récupération d'accès.** Cocher.
Vérifié : lien de connexion reçu par email (capturé) et ouvrant l'espace, liens à usage unique/expirés, récupération,
révocation (`auth-e2e-local`, `recette-technique-e2e`). Reste : email réel reçu sur une vraie boîte — **Loïc** (REL-05).

## Médias

**MED-01 — Compression des images sur mobile.** Cocher.
Vérifié (`med01-compression-images`, Chromium mobile, parcours réel /compte) : 48 Mpx 17 Mo → 0,21 Mo 1600 px ; rotation
EXIF appliquée (portrait redressé) ; petite photo inchangée ; PNG transparent converti en JPEG (transparence perdue : à
valider métier). Tous les envois < 4 Mo (limite Vercel ~4,5 Mo). Reste : iPhone/Safari et HEIC réels — **Mathieu** (téléphone).

**MED-02 — Envoi vidéo.** Cocher.
Le code actuel n'a plus de compression navigateur : envoi direct vers le stockage (2 Go max, 3 essais) puis allègement
serveur. Vérifié (`med02-envoi-video`, réseau ralenti) : vidéo 18,5 Mo, progression continue, fichier stocké identique,
annulation sans fichier orphelin ni rattachement. Reste : Safari iOS et Firefox réels, selftape long avec son — **Mathieu**.
Remarque : le commentaire de Loïc parle d'une limite à 500 Mo, le code est à 2 Go (`VIDEO_MAX_OCTETS`) — **Loïc** à trancher.

**MED-03 — Erreurs et limites d'upload.** Cocher.
Vérifié : message clair pour fichier trop lourd (photo > 20 Mo), illisible, faux type (`bug11`) ; requêtes jusqu'à 50 Mo
acceptées par l'appli (correctif `proxyClientMaxBodySize`) ; annulation vidéo propre (`med02`). Reste : coût et charge de
l'allègement serveur avec beaucoup d'activité (commentaire de Loïc) — **Loïc**.

## Communications

**COM-01 — Emails sans secrets de prod.** Cocher.
Ajouté : capture locale Mailpit (`BOOKING_TEST_SMTP_URL`, hôtes privés seulement). Vérifié : invitation d'assistante,
convocation, lien de connexion capturés et contenus contrôlés. Reste : envoi réel depuis Gmail en préproduction — **Loïc**.

**COM-02 — Notifications et isolation.** Cocher.
Vérifié : table `notifications` dans l'audit inter-équipes (aucune ligne d'une autre équipe lisible ou modifiable),
messages tracés par figurante, erreurs de lecture signalées (`bug13`). Reste : recette métier « qui reçoit quoi » — **Mathieu**.

**COM-03 — Notifications push.** Ne pas cocher.
Le push est volontairement désactivé en mode test (aucun envoi réel) ; non testable sans clés VAPID et un vrai téléphone.
À faire en préproduction — **Loïc** (configuration) et **Mathieu** (téléphone).

**COM-04 — Signatures et modèles.** Cocher.
Vérifié : contenu de la convocation conservé à l'identique (date incluse) jusqu'à l'email capturé. Reste : relecture des
textes et signatures par projet — **Loïc et Mathieu**.

**COM-05 — Mail support.** Ne pas cocher.
Dépend d'une boîte Gmail support et de ses variables (documentées dans `docs/secrets.md`) ; aucune action possible sans ces
accès — **Loïc**.

## Parcours métier (MET)

Tous vérifiés par `recette-technique-e2e` (41 contrôles), `bug13-erreurs-mutations`, `sec04`/`bug02` (isolation) et
`qa06-mobile-a11y`. Pour chacun : **Cocher**, recette métier à faire par **Loïc et Mathieu**.

- **MET-01 — Projet.** Corrigé : tout membre pouvait archiver/supprimer ; désormais réservé à la créatrice (commentaire de
  Loïc). Vérifié : refus pour l'assistante, archivage/désarchivage par la créatrice, projet archivé consultable, suppression
  refusée avant 1 an, échecs de base signalés (archivage d'abord, puis profils temporaires). Question de Loïc sur la
  compression à l'archivage : non traitée (décision).
- **MET-02 — Annonce.** Vérifié : annonce ouverte visible publiquement, fermée retirée et sans formulaire, réouverture.
  Conforme au commentaire de Loïc (reste active tant qu'elle n'est pas supprimée). Reste : QR/poster, limite de candidatures.
- **MET-03 — Tri des candidatures.** Vérifié : rangement dans un onglet, fiche de candidature. Reste : tris, badges, export.
- **MET-04 — Candidature → booking.** Vérifié : booking lié à la candidature, visible côté candidate ; changement de date et
  retrait signalent maintenant un covoiturage non mis à jour au lieu d'un faux succès.
- **MET-05 — Journée de booking.** Vérifié : planning de la journée, convocations (avec et sans boîte d'envoi).
- **MET-06 — Essayages.** Vérifié : statut d'essayage, page journée.
- **MET-07 — Casting.** Vérifié : ajout au rôle (fiche comédien·ne jumelle pour un cachet rôle, fiche d'origine intacte),
  statut, dépôt vidéo par lien (`med02`), suppression refusée signalée.
- **MET-08 — Documents.** Vérifié : 8 documents de journée chargés et listant la figurante. Reste : impression/PDF/XLSX/vCard.
- **MET-09 — Barème.** Barème par équipe (décision). Vérifié : montant de l'équipe au bordereau (arrondi à l'euro),
  indemnité appliquée et visible ; indemnité d'un autre projet refusée ; suppression refusée signalée.
- **MET-10 — Équipe.** Vérifié : invitation (compte + rattachement + email capturé), révocation, restriction par section.
- **MET-11 — Pages publiques de partage.** Vérifié (`sec05-share-links`) : 11 types de liens (valide, inexistant, tronqué,
  révoqué, contacts masqués). Reste : lisibilité en navigation privée sur mobile.

## Mineurs et légal

Tous vérifiés par `leg-mineurs-rgpd-e2e` (30 contrôles sur l'appli réelle) en plus des suites SQL `guardians-local`,
`minor-dossiers-local`, `minor-identity-local`, `booking-age-local`, `rgpd-transaction-local`.

**LEG-01 — Représentant légal.** Cocher. Vérifié : représentants exigés pour tout mineur à la candidature (y compris la veille
des 18 ans), emails enfant/représentants distincts, second représentant absent seulement pour motif valable (décédé /
sans autorité), enregistrement des deux fiches. Reste : conformité aux règles DEC-03 — **Mathieu**.

**LEG-02 — Autorisations.** Cocher. Vérifié : dossier mineur (refusé pour un majeur), pièce demandée par projet, lien de dépôt
parent sans compte (aucun autre dossier visible), dépôt d'autorisation PDF, faux PDF refusé, validation par l'équipe,
révocation des liens ; **un mineur ne peut pas être booké tant que le dossier est incomplet**. Reste : recette métier — **Mathieu**.

**LEG-03 — Dossier DRIEETS.** Cocher. Vérifié : dates de tournage (période inversée refusée) et de commission, préparation
DRIEETS bloquée avec message explicite tant qu'une information manque (ex. société de production), puis générée avec enfant,
représentants, commission et pièce validée ; lien de partage production. Reste : vérifier que le document correspond au
dossier attendu par la DRIEETS — **Mathieu**.

**LEG-04 — Règles d'âge.** Cocher. Vérifié à la candidature : 14 ans et « 16 ans demain » refusés sur une annonce non ouverte
aux mineurs, 16 ans le jour même accepté, 12 ans accepté sur annonce ouverte aux mineurs, 18 ans le jour même majeur.
Reste : cas métier particuliers — **Mathieu**.

**LEG-05 — Anonymisation RGPD.** Cocher. Vérifié : anonymisation par la propriétaire d'un profil mineur avec candidature,
messages, photos, représentants et pièces de dossier → plus aucune donnée identifiante, photos effacées du stockage ;
refusée à une assistante. Reste : essai sur un vrai profil ancien en préproduction — **Loïc**.

**LEG-06 — Pages légales.** Ne pas cocher. Relecture juridique et coordonnées — **Loïc et Mathieu**.

## Qualité

**QA-06 / BUG-17 — Mobile.** Cocher. `qa06-mobile-a11y` : 55 écrans × 4 rôles à 375 px ; 7 débordements corrigés
(tableaux équipe/barème défilants, en-têtes et boutons qui passent à la ligne). Reste : confort d'usage sur téléphone — **Mathieu**.

**QA-07 / BUG-18 — Accessibilité.** Cocher. 30+ champs sans nom accessible corrigés ; 0 défaut restant au scan. Limite :
contrôle DOM (pas de lecteur d'écran ni mesure de contraste) — **Éléa** si un audit complet est souhaité.

**QA-08 — Suivi des erreurs.** Cocher. Journal `[booking-error]` (une ligne JSON par erreur serveur ou navigateur :
environnement, commit, route sans token, pile) ; secrets, emails, téléphones, jetons masqués ; test avec secrets plantés.
Aucun service externe (pas de coût). Reste : vérifier dans les logs Vercel de préproduction — **Loïc**.

**BUG-13 — Erreurs Supabase ignorées.** Cocher. Inventaire automatique des écritures sans contrôle d'erreur : 20 corrigées
(projets, indemnités, casting, notifications, validation, réponses email, liens de profil, covoiturage) ; 2 tolérées
volontairement et commentées (journal d'envoi vidéo, modèle de question). Deux trous d'accès fermés au passage (indemnités
et réponses email sans projet). `bug13-erreurs-mutations` force de vraies erreurs de base : 10/10.

## Mise en production

**REL-01 / REL-02 / REL-05.** Ne pas cocher. Préproduction, copie de base et déploiement hors périmètre de la reprise
(aucun accès ni dépense) ; procédure prête : `docs/mise-en-production.md` — **Loïc / Éléa**.

**REL-03 — Recette métier finale.** Ne pas cocher. Par définition à faire par **Loïc et Mathieu** sur la préproduction.

## Non traitées (consigne du 30/10)

Nouveau logo, A&A-01, RV2-1/2/3 : laissées de côté à la demande de l'utilisateur (ni commentaire ni coche).
