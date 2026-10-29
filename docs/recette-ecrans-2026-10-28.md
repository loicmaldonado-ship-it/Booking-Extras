# Recette des écrans — 28 octobre 2026

Environnement : copie locale sur 127.0.0.1:3200, base fictive isolée sur 127.0.0.1:29194, BOOKING_TEST_MODE=1. Compte cheffe fictif, sauf mention contraire. Aucun envoi externe ni suppression effectué. Les ouvertures indiquées ne constituent pas une vérification exhaustive des fonctionnalités ou des droits.

| Écran ou parcours | État | Vérification ou suite |
|---|---|---|
| Projets, détail et modification | OK ouverture | Projet fictif affiché ; formulaire ouvert sans sauvegarde. |
| Annonces, création, détail et modification | OK ouverture | Annonce fictive et formulaires affichés sans sauvegarde. |
| Candidatures et détail | OK ouverture | Liste et fiche Sacha affichées ; parcours de deux jours vérifié précédemment (CAN-08). |
| Base profils, fiche et modification | OK ouverture | Fiche Sacha et formulaire affichés sans sauvegarde. |
| Bookings et journée | OK partiel | Liste et tableau du 11/11 ; création et duplication fictives vérifiées précédemment. Planning complet à vérifier. |
| Casting et présentiel | OK partiel | Journée fictive 25/11 créée, créneau 10h–10h30 affiché dans le planning. Attribution et parcours de partage/upload à vérifier. |
| Essayages et journée | OK ouverture | Liste et journée du 11/11 affichées ; essai de modification antérieur documenté dans WORK_PROGRESS.md. Planning complet à vérifier. |
| Documents | À confirmer | Page de planning de casting présente ; autres documents et exports à vérifier. |
| Équipe, mon compte, admin | OK ouverture | Pages affichées pour la cheffe ; actions sensibles non exécutées. |
| Compte candidat | OK partiel | Espace et déconnexion testés précédemment ; autres fonctions à vérifier. |
| Rôles et isolation entre projets | À confirmer | Assistante et restriction équipe partiellement testées précédemment ; contrôle multi-projet navigateur incomplet. |

## Anomalie ENV-04-01 — avatar du compte fictif indisponible

- Préconditions : site et base de recette ci-dessus, cheffe fictive connectée.
- Étapes : ouvrir `/projets`, puis les autres écrans avec l'en-tête connecté.
- Attendu : l'avatar du compte ou son remplacement s'affiche sans erreur serveur.
- Obtenu : erreur répétée du serveur Next sur l'image `profile-avatars/seed/avatar-cheffe.png` (réponse Storage HTTP 400). Les pages restent utilisables ; aucune erreur console navigateur relevée pendant les ouvertures. Le seed référence ce chemin ; la présence du fichier et la cause exacte restent à confirmer.
- Aucun fichier ou donnée de test supprimé ; capture non réalisée.

Les éléments « OK ouverture » indiquent uniquement que l'écran s'affiche ; les contrôles réseau exhaustifs, les actions et les permissions restent à compléter avant de clôturer ENV-04.

## Anomalie ENV-04-02 — profils du casting présentiel invisibles (corrigée localement)

- Préconditions : cheffe fictive, projet de test, rôle « Rôle recette fictif », Sacha associée au rôle et ajoutée à la journée présentielle du 25/11.
- Étapes : ouvrir la journée puis son planning.
- Attendu : le profil ajouté apparaît dans la journée et dans le planning.
- Obtenu avant correction : zéro profil affiché malgré la ligne présente dans la base fictive. L'API locale renvoie PGRST201 : deux relations possibles entre la participation et le rôle.
- Correction : préciser la clé de relation dans les deux lectures. Après rechargement, Sacha apparaît dans la journée et dans « Sans créneau » du planning. Suite automatisée 345/345, TypeScript et ESLint ciblés réussis. Affectation au créneau et autres vues restent à vérifier.

- Suite ENV-04-02 : rôle fictif créé et Sacha associée sans envoi ; rôle affecté au profil sur la journée puis glissé sur le créneau 10h–10h30. La journée affiche 1/3 et le planning liste ainsi que sa vue trombi affichent Sacha et le rôle. Export PDF et permissions multi-équipe non testés.

## Anomalie ENV-04-03 — export planning centré et nom tronqué (corrigée localement)

- Reproduction : sur le planning de casting fictif du 25/11 en vue trombi, télécharger le PDF. Avant correction, le contenu court est centré très bas sur la page et le nom de Sacha est tronqué.
- Après correction, le contenu est aligné en haut et le nom complet est affiché sur deux lignes ; PDF A4 d'une page téléchargé et contrôlé visuellement. Un trombinoscope bookings fictif en paysage a aussi été téléchargé et contrôlé : alignement correct, mais les noms longs restent tronqués dans cette autre grille, à traiter séparément en tenant compte de sa pagination fixe.

## Anomalie MET-04 — fonction facultative refusée pour un booking

- Carte associée : MET-04. Sévérité : majeure ; corrigée par `333a408`.
- Environnement : copie de recette sur localhost:3200, base fictive 29194, mode test ; reproduction sur le code `df7a1a6`, cheffe fictive et projet de test.
- Préconditions : candidature fictive Sacha sélectionnée, projet de test.
- Étapes : choisir « Envoyer en booking sur une autre date », sélectionner le 30 octobre et le cachet Figurant, laisser la fonction vide et valider.
- Attendu : le profil est ajouté puisque la fonction est affichée facultative. Obtenu avant correction : « Choisis une fonction », sans ajout ; la propriété facultative n’était pas transmise à l’action serveur.
- Après correction : ajout visible, une ligne en base pour le 30 octobre, sans fonction et avec cachet Figurant. Vérification navigateur et base fictive ; 15 tests ciblés, TypeScript sans cache et ESLint réussis. Aucun email réel.
- Module : `src/components/bookings/add-to-journee-bar.tsx`. Régression : conserver un test de bout en bout du formulaire facultatif et vérifier aussi le mode où la fonction est obligatoire.

## Anomalie ENV-05-01 — filtre RGPD incohérent après retour arrière

- Cartes associées : ENV-05, QA-07. Sévérité : majeure pour la compréhension des résultats ; corrigée localement par `f366c6a`.
- Environnement : navigateur de recette, `localhost:3200`, base fictive 29194, compte cheffe fictif. Version reproduite : code précédent `f366c6a` ; SHA exact non relevé.
- Préconditions : ouvrir la liste RGPD avec la durée de trois ans.
- Étapes : choisir un an, appliquer le filtre, puis revenir à la page précédente du navigateur.
- Attendu : le champ de durée et les résultats correspondent à trois ans. Avant correction : les résultats reviennent à trois ans mais le champ indique encore un an.
- Après correction : le champ et les résultats indiquent tous deux trois ans dans le navigateur de recette. ESLint ciblé réussi ; autres navigateurs non vérifiés.
- Module : `src/app/rgpd/page.tsx`. Régression à maintenir : retour arrière après changement de durée et contrôle simultané du champ et des résultats.

## Anomalie ENV-05-02 — filtres de listes conservés après retour arrière

- Cartes associées : ENV-05, QA-07. Sévérité : mineure ; corrigée localement par `07139b4`.
- Environnement : navigateur de recette, `localhost:3200`, base fictive 29194 et compte cheffe fictif. Version reproduite : code précédent `07139b4` ; SHA exact non relevé.
- Préconditions : ouvrir la liste des projets avec « Type (tous) ».
- Étapes : choisir le type Film et appliquer, puis utiliser le retour arrière du navigateur.
- Attendu : le champ revient à « Type (tous) » avec les résultats correspondants. Avant correction : le champ gardait Film alors que les paramètres chargés étaient revenus en arrière.
- Après correction : le champ retrouve « Type (tous) » ; le retour arrière des annonces et profils a également rétabli respectivement « Statut (tous) » et « Genre (tous) ». ESLint ciblé réussi ; autres navigateurs non vérifiés.
- Modules : `src/app/projets/page.tsx`, `src/app/annonces/page.tsx`, `src/app/figurants/page.tsx`. Régression à maintenir : comparer les contrôles affichés aux paramètres et aux résultats après retour arrière.

## Anomalie CAN-08 — second jour inaccessible après le premier booking

- Cartes associées : CAN-08, ENV-05. Sévérité : majeure ; corrigée localement par `52e260e` et `eb5f9d2`.
- Environnement : navigateur de recette, copie locale sur `localhost:3200`, base fictive 29194 et compte cheffe fictif. Version reproduite : code avant `52e260e` ; SHA exact non relevé.
- Préconditions : candidature fictive valide avec disponibilités les 11 et 12 novembre ; projet de test.
- Étapes : ouvrir le panneau des jours, envoyer la candidature au booking du 11 novembre, puis tenter d’accéder au 12 novembre, y compris après fermeture et réouverture du panneau.
- Attendu : le premier jour est marqué déjà booké et le second reste accessible. Avant correction : le panneau perdait les disponibilités après le premier envoi ; la candidature envoyée disparaissait aussi du tri, empêchant la reprise du jour restant.
- Après correction : premier jour marqué déjà booké ; second accessible après fermeture et réouverture, puis second booking créé. Après rechargement, les deux jours sont marqués bookés ; les deux lignes de disponibilité sont conservées en base fictive. Suite 258/258, TypeScript et ESLint ciblé réussis lors de la recette. Aucun email réel.
- Modules : `src/app/candidatures/page.tsx`, `src/components/candidatures/reprendre-jours.tsx`, `src/lib/candidatures/jours-panel-snapshot.ts`. Régressions : `tests/candidature-deux-jours-flow.test.mjs`, `tests/candidature-jours-panel-snapshot.test.mjs`. Recette métier ultérieure.
