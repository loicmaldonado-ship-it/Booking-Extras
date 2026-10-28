# Suivi Booking Extras

- Branche : `tests/integration-main-elea-2026-10-22` ; base : `f47137e0316587c49aaa0aeb53acda2c6cc1258d`.
- Carte en cours : BUG-13, partielle. Une erreur de lecture des onglets fixes empêche le déplacement des candidatures ; les échecs de lecture des candidatures, de recherche de bookings et de préparation de journée empêchent leur création et sont signalés. Après création de bookings, une erreur de mise à jour des profils est désormais signalée avec le nombre déjà créé et les vues sont actualisées. Le reste des mutations doit encore être audité.
- Cartes achevées pendant cette session : aucune. BUG-16 reste à vérifier fonctionnellement.
- Fichiers modifiés : `src/lib/candidatures/jours.ts`, `tests/candidature-jour-protected-read.test.mjs`, `tests/candidature-jour-booking-errors.test.mjs`, ce fichier.
- Tests : reproduction du défaut avant correction ; test ciblé réussi ; `npm test` : 205 réussis, 0 échec ; ESLint ciblé réussi.
- Environnement : contrôles hors sandbox : application locale HTTP 200, Supabase local répond HTTP 404 à sa racine et conteneurs Supabase actifs ; URL Supabase de `.env.local` : 127.0.0.1:54321. Aucun reset de base. Parcours navigateur et sécurité complète non vérifiés.
- Push : échec d’authentification GitHub HTTPS (identifiants refusés) ; commit `fce887d` conservé localement.
- Prochaine action : vérifier les parcours locaux, puis traiter dans BUG-13 les mutations partielles : `envoyerCandidaturesDansJour` signale maintenant l’échec de mise à jour après insertion mais reste non transactionnelle ; étudier une transaction et ses règles de droits avant modification. Ne pas marquer BUG-13 terminé avant audit complet.
