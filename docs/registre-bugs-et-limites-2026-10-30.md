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
| 12 | Tout membre d'un projet pouvait l'archiver, le désarchiver ou le supprimer | MET-01 | `requireCreatriceProjet` |
| 13 | Envoi de textos : une sélection mal formée faisait planter l'action | BUG-02 | validation `lignesTextos` |
| 14 | 7 écrans débordaient à 375 px (tableaux équipe/barème, en-têtes, indemnités) | QA-06 / BUG-17 | conteneurs défilants, retours à la ligne |
| 15 | 30+ champs sans nom accessible (barème, indemnités, questions, dates, liens, messages) | QA-07 / BUG-18 | `aria-label` / `aria-labelledby` |
| 16 | 20 écritures en base sans contrôle d'erreur (faux succès : suppression de projet, archivage, rôles, indemnités…) | BUG-13 | contrôles + messages ; ligne avant fichiers |
| 17 | Indemnités : suppression/application sans contrôle d'accès si la lecture échouait ; indemnité d'un autre projet applicable | BUG-13 | lecture obligatoire, projet vérifié |
| 18 | Réponses email sans projet effaçables par tout membre d'équipe | BUG-13 | seules les réponses d'un projet accessible |
| 19 | Archivage : profils temporaires supprimés AVANT l'archivage (perdus si l'archivage échouait) | BUG-13 | archivage d'abord |
| 20 | **Export Myrole sans aucun contrôle d'accès** : une cheffe d'une autre équipe téléchargeait l'export complet (identité, email, téléphone, naissance, adresse) des figurants confirmés de n'importe quel projet | SEC-04 / MET-08 | `checkProjetAccess` dans `/bookings/export-myrole` |
| 21 | Manifeste et icônes de l'appli redirigés vers /login pour les visiteurs (préfixe public erroné « /manifest.ts ») : installation sur téléphone cassée sur les pages publiques | QA-06 | préfixes `/manifest.webmanifest`, `/manifest-icon` |
| 22 | 5 débordements à 320 px (adresse Google, champ fichier, bouton des modèles) | BUG-17 | retours à la ligne / largeur max |
| 23 | Textos : rattachement possible à un projet et un profil d'une autre équipe (réponses SMS déversées chez elle) — trouvé par la relecture indépendante | SEC-04 / BUG-02 | projet accessible + profil lié, sinon ignorés |
| 24 | Réponses sans projet : affichées mais jamais effacées, sans message | BUG-13 | effaçables si la personne est bookée sur un projet accessible |
| 25 | Boutons archiver/supprimer visibles pour tous les membres, échec silencieux | MET-01 | boutons réservés à la créatrice, erreurs affichées |
| 26 | Nettoyage des profils temporaires impossible à relancer après un archivage partiel | MET-01 / BUG-13 | bouton « Supprimer les profils temporaires restants » |
| 27 | Erreurs levées par les actions masquées en production (écran générique) | BUG-13 / QA-08 | `{ error }` affichés + page d'erreur `src/app/error.tsx` |
| 28 | Derrière un proxy HTTPS : contrôle d'origine du PDF de rôle et protocole du QR code erronés | QA-06 | comparaison d'hôte, `x-forwarded-proto` |
| 29 | Aucun en-tête de sécurité HTTP (clickjacking possible, pas de nosniff/HSTS, Next signalé par X-Powered-By) | SEC | en-têtes dans `next.config.ts`, `tests/securite-entetes.mjs` |
| 31 | Lighthouse : `/robots.txt` renvoyait une page HTML ; texte vert, ambre et corail trop peu contrasté (badges, montants du barème) ; vignette photo des candidatures sans nom accessible | QA-06 / QA-07 | `src/app/robots.ts`, couleurs assombries dans `globals.css`, `aria-label` ; vérifié par Lighthouse et `tests/securite-entetes.mjs` |
| 32 | HSTS envoyé aussi en local : Safari et Firefox forçaient ensuite https://localhost sur tous les ports | SEC | HSTS seulement si `NEXT_PUBLIC_SITE_URL` est un domaine public en https |
| 33 | Appels automatiques en tâche de fond (présence de l'équipe, cloche, relève des mails, liens de validation et de partage) : s'ils étaient interrompus (changement de page, réseau coupé), erreur JavaScript non gérée, remontée dans le journal d'erreurs ; constaté sous Firefox et Safari en passant par `/mineurs` | QA-08 / BUG-13 | erreurs interceptées, nouvel essai au tour suivant ; `tests/passe-complete.mjs` sous Firefox et WebKit |
| 34 | Lanceur de recette : la base ne démarrait pas si une autre base Supabase locale tournait déjà (port 54325 de la boîte mail de test non déplacé) ; photo de la cheffe du seed absente | QA-06 | port déplacé (29245), avatar fictif déposé au démarrage ; vérifié depuis l'archive ZIP (3 comptes, arrêt) |
| 30 | 25 pages de documents et 5 pages de détail débordaient sur téléphone une fois remplies ; exports préchargés comme des pages (requêtes en échec) | QA-06 / BUG-17 | `tests/passe-complete.mjs` (96 adresses × 4 rôles × 4 largeurs) |
| 35 | **Prise de compte candidat** : une cheffe d'une autre équipe pouvait changer l'email d'une fiche reliée à un compte candidat (base partagée), puis demander un lien de connexion à sa place ; elle pouvait aussi la basculer en comédien·ne pour la cacher des autres équipes et bloquer sa connexion (audit sécurité indépendant du 31/10) | SEC | email et statut comédien·ne d'un compte candidat modifiables seulement par la personne ou le compte propriétaire (`saveFigurantUpdate`) ; `tests/sec06-audit-2026-10-31.mjs` |
| 36 | **Casting sans compte** : connaître l'email et le nom d'un·e comédien·ne suffisait pour ouvrir sa page d'envoi (date de naissance, ville, mensurations, envoi de vidéos en son nom) | SEC | si la fiche existe, le lien d'envoi part par email à l'adresse enregistrée, réponse identique dans tous les cas ; une nouvelle personne garde le parcours direct |
| 37 | Jokers `%` / `_` non échappés dans l'inscription publique, la candidature, la jonction d'un casting connecté·e : « % » en nom + téléphone d'une autre personne renvoyait son adresse masquée ; un email à jokers permettait d'énumérer les comptes ou de rejoindre la fiche comédien·ne d'un·e autre | SEC | `echapperMotif` partout ; `tests/like-jokers-publics.test.mjs` |
| 38 | Réponses mail/SMS « sans projet » de toutes les équipes renvoyées par `checkEmailReplies` appelée sans date ; `marquerReponseLueGmail` acceptait tout le personnel pour ces réponses | SEC / BUG-13 | toujours limité aux personnes bookées sur un projet accessible |
| 39 | Fonction `enregistrer_fonction_projet` (SECURITY DEFINER) appelable avec la clé publique : ajout de « fonctions » dans le projet de n'importe quelle équipe | SEC | migration `20261031120000` (droit d'exécution retiré ; seuls les déclencheurs l'appellent) |
| 40 | Allègement vidéo : ffmpeg devinait le format d'un fichier envoyé par un·e candidat·e ; une liste de lecture HLS/concat déguisée en .mp4 pouvait lui faire lire des fichiers du serveur | SEC | conteneur reconnu aux premiers octets, démultiplexeur imposé, protocole `file` seul ; `tests/allegement-format-conteneur.test.mjs` |
| 41 | Essayage rattachable à la journée d'essayage d'une autre équipe ; entrée de casting rattachable au booking ou à la candidature d'un autre projet | SEC | appartenance au projet vérifiée |
| 42 | Liens bande démo / Instagram saisis par les candidats acceptés sans contrôle (`javascript:`…) ; vCard : retour chariot non échappé | SEC | seules les adresses http(s) (complétées en https:// si besoin) ; échappement `\r` |
| 43 | Base Profils lisible par l'API pour tout le personnel, même une assistante sans la section « Base Profils » (identité, naissance, téléphone, adresse, mensurations, notes) | SEC | migration `20261102100000` : lecture complète réservée aux personnes qui ont la section ; une assistante restreinte garde les fiches de ses projets (bookings, casting, essayages, **candidatures**), les **noms seuls** de la base dans ses listes de choix (`figurants_choix`) et peut toujours booker ces personnes ; doublons signalés sans email ni téléphone ; `tests/sec07-base-profils-section.mjs` |
| 44 | Inscription, candidature et casting publics sans limite de débit (création de comptes en masse, envois d'emails répétés vers une adresse) | SEC | migration `20261102110000` : 100 demandes/heure par connexion, 8/heure par adresse email (clés HMAC, aucune IP ni email en clair), refus si la base ne répond pas ; candidat·e connecté·e non concerné·e ; `tests/limites-publiques-local.sql`, `tests/sec08-limite-inscriptions.mjs` |
| 45 | Réponses par email rattachées sur la seule adresse « De » (falsifiable) | SEC | résultat SPF/DKIM/DMARC lu dans le premier en-tête `Authentication-Results` de Gmail : sans validation alignée, le message est importé avec l'avertissement « Expéditeur non vérifié » et sans indice oui/non ; `tests/email-expediteur-authentifie.test.mjs` |
| 46 | ffmpeg 4.1 (2018) pour l'allègement des vidéos | SEC | remplacé par ffmpeg 7.0.2 (`ffmpeg-static`, binaire téléchargé pour la plateforme à l'installation) |
| 47 | Politique de contenu (CSP) sans `script-src` : un script injecté dans une page se serait exécuté | SEC | CSP complète posée par le middleware avec un nonce par requête (`src/lib/securite/csp.ts`) : scripts de Next seuls, gestionnaires d'événements injectés et `eval` bloqués, connexions limitées au site et à Supabase ; conversion HEIC passée sur la version « csp » de heic-to ; `tests/csp-navigateur.mjs` (Chromium, WebKit, Firefox), `tests/securite-entetes.mjs` |
| 48 | Boutons « Rechercher » (raccourci ⌘K lu dans le nom) et « Notifications » (compteur absent du nom) : nom accessible différent du texte affiché (Lighthouse) | QA-07 | `aria-hidden` sur ⌘K ; « Notifications, N non lues » |
| 49 | Menu « Mineurs / DRIEETS » sans projet actif : renvoi silencieux vers la liste des projets, la page semblait ne pas exister (signalé par Éléa le 02/11) | MET / LEG | la page propose les projets en cours, chacun menant à ses dossiers mineurs ; `tests/mineurs-entree-menu.mjs` |
| 50 | Copie de recette (port 3100) : liens d'invitation d'une cheffe ou d'une assistante et de mot de passe oublié de l'équipe renvoyés vers le port 3000, où rien ne tourne | ENV-06 / MET-10 | le lanceur règle l'adresse du site et les retours autorisés sur 3100 ; deuxième cheffe créée de bout en bout sur une copie neuve ; `tests/invitation-cheffe-e2e.mjs` |
| 51 | Copie de recette : emails de l'application (convocations, candidature reçue, lien de connexion candidat) jetés au lieu d'être capturés | ENV-06 / COM-04 | le lanceur les envoie à la boîte locale de la copie (http://localhost:29244) ; vérifié avec un lien de connexion candidate |

### Passe de sécurité et Lighthouse du 02/11/2026 (après les bugs 43 à 48)
- **Boîte noire** (`tests/sec09-passe-boite-noire.mjs`, 11/11) : aucune des 77 tables lisible ou modifiable anonymement, stockage
  non listable ; une assistante sans « Base Profils » n'obtient rien d'une personne de la base dans aucune des 23 tables liées
  aux profils ; pas d'auto-élévation de droits ; pas de redirection ouverte ; action serveur refusée depuis une autre origine ;
  CSP présente aussi sur les erreurs ; aucun secret serveur dans les 93 fichiers envoyés au navigateur. Seule fonction
  appelable anonymement : `nom_onglet_journee` (nom d'onglet d'une date, sans donnée).
- **Lighthouse** (10 écrans × téléphone et ordinateur) : bonnes pratiques 100 ; accessibilité 96–100 (le 96 = mot « EXTRAS »
  du logo, hors périmètre) ; performance 81–100 (77–100 le 30/10) ; audit CSP/XSS désormais réussi partout. Pages
  « Base Profils » et « Candidatures » sur téléphone en 4G simulée : texte principal affiché vers 4 s.
- **Navigateurs** : parcours complet de 96 adresses × 4 rôles sans problème sous Chromium (460 visites), Firefox (230) et WebKit
  (230, via le relais HTTPS) ; CSP vérifiée aussi en mode développement (`next dev`, lanceur de recette) dans les trois moteurs.

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
- **Actions anciennes qui lèvent encore des erreurs** : plusieurs actions antérieures à la reprise lèvent une erreur au lieu de
  renvoyer `{ error }` ; en production l'utilisateur voit alors la page d'erreur « Une erreur est survenue » (avec référence),
  plus l'écran générique. À convertir progressivement.
- **`/api/erreurs-client`** : public, limité à 20 signalements par minute et par adresse (par instance) ; contenu nettoyé, rien n'est stocké.
- **Fluidité** : mesurée avec 3 000 profils, 800 candidatures et 300 bookés sur une journée : écrans entre 0,15 et 0,4 s, sauf la page journée (`/bookings/documents`, 1,5 s, 132 Ko compressés) dont le tableau éditable est dense ; à surveiller au-delà de ~300 personnes par journée (pagination ou virtualisation à décider).
- **`src/middleware.ts`** : convention dépréciée en Next 16 au profit de `proxy.ts` ; fonctionne, à migrer.
- **Non vérifié en production** : aucune action sur la prod, ni sur Vercel/Supabase de production (variables, sauvegardes).
- **Recette métier** (MET-xx, CAN-05/06/07/09, LEG-xx, COM-xx, QA-06) : à faire par Loïc et Mathieu ; les tests techniques ne la remplacent pas.
- **Envois réels** (emails, SMS, push) : bloqués en mode test ; emails capturés localement (Mailpit) et vérifiés, envoi Gmail réel et push non validés.
- **Navigateurs** : tests automatiques sur Chromium, WebKit (moteur de Safari, via le relais HTTPS local) et Firefox ; Safari sur iPhone réel, photos HEIC et vidéos d'iPhone restent à tester sur appareils.
- **Accessibilité** : contrôle automatique (noms des champs, débordements) et Lighthouse (contrastes, noms des liens) sur 10 écrans × téléphone, tablette, ordinateur ; pas de test au lecteur d'écran. Le mot « EXTRAS » du logo, en lilas clair, reste sous le seuil de contraste : les logos en sont exemptés et la carte « Créer nouveau logo » est hors de cette reprise.
- **Vercel ~4,5 Mo par requête** : dépend de la compression d'images côté navigateur (MED-01).
- **Médias annulés en cours d'envoi** : vérifié sans fichier orphelin pour une annulation en cours de transfert (`med02`) ; un fichier entièrement transféré juste avant l'annulation reste possible.
- **Lien de partage d'un projet archivé** : reste accessible (cohérent avec MET-01, à confirmer).
- **Verrouillage d'un compte candidat** : 6 demandes en 15 minutes sur une adresse bloquent aussi l'envoi du lien de
  connexion (protection contre l'envoi massif d'emails) ; un tiers peut donc gêner la connexion d'une personne qu'il connaît.
- **Limite de débit des parcours publics** (bug 44) : en dehors de Vercel, l'adresse IP n'est pas fiable et toutes les
  demandes partagent un même compteur (100/heure) ; un message « déjà un compte avec cet email » reste volontaire
  (parcours de récupération).
- **Réponses par email** (bug 45) : vérifiées par les résultats SPF/DKIM/DMARC de Gmail ; une réponse non vérifiée est
  importée avec un avertissement plutôt qu'écartée (pour ne pas perdre une vraie réponse). Non testé sur une vraie
  boîte Gmail (relève coupée en local).
- **ffmpeg 7.0.2** (bug 46) : le binaire est téléchargé depuis GitHub par `npm install` ; l'installation (Vercel, iMac) doit
  avoir accès à Internet.
- **Dépendances** : aucune alerte haute ou critique. Restent des alertes « modérées » sur `minimatch` (nouvel avis
  GHSA-g3hv-75wg-m249, corrigé seulement en v11) : dans les outils de développement (ESLint, non déployés), et dans
  exceljs → archiver → glob 7, dont le code de recherche de fichiers n'est jamais appelé par l'export Excel (aucun motif
  fourni par un utilisateur). `readdir-glob` (archiver) est passé à minimatch 11 ; glob 7 n'est pas compatible avec la v11.
- **CSP** (bug 47) : `style-src` garde `'unsafe-inline'` (attributs style de React, sans exécution de code) ; HSTS et
  `upgrade-insecure-requests` seulement sur un domaine public en HTTPS. Les pages doivent rester rendues à la demande
  (nonce par requête) : une future page statique perdrait ses scripts.
- **Conversion HEIC** : vérifiée par le mécanisme (WebAssembly dans un worker sous la CSP, trois moteurs) ; pas de vraie
  photo HEIC dans l'environnement de test, à valider sur iPhone.
- **`tests/rgpd-snapshot-local.sql`** dépend d'identifiants de l'ancienne base de recette ; non exécuté par la batterie.
- **Hors périmètre (V2 / décisions à prendre)** : abonnement payant (A&A-01), fonctions d'administration et signature
  électronique (RV2-1/2/3), nouveau logo.
