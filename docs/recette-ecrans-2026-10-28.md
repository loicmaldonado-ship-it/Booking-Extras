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
