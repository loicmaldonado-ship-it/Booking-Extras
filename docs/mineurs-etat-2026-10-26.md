# Mineurs — vérifications du 26 octobre 2026

Lot LEG-01, fondé sur DEC-03 : deux représentants structurés (nom, prénom, adresse, téléphone, email), trois emails distincts ; second représentant dispensé uniquement pour décès ou absence d’autorité parentale. Données dans une table privée, sans accès direct public ni staff générique. Les formulaires compte, inscription, invitation et candidature collectent ces champs pour les moins de 18 ans. Les majeurs ne les soumettent pas.

Vérifié réellement : 4 tests de dates/validation, 3 tests d’actions privées (anonyme refusé, faux identifiant ignoré, arrêt sur échec d’identité), SQL local `guardians-local.sql` et `minor-identity-local.sql` (création de compte, activation et candidature incomplètes refusées, exceptions, rollback et identité atomique), régressions SQL authentification et invitations. Suite globale : 142 tests avant ajout des 3 tests d’actions, tous passants ; compilation finale réussie. Le test SQL force les contraintes différées à s’exécuter, il ne se contente pas d’annuler les fixtures avant leur déclenchement.

Navigateur : compte fictif Sacha passé de majeur à 17 ans, deux contacts fictifs enregistrés, page rechargée, deux contacts effectivement préremplis. Date de naissance adulte rétablie ensuite. Capture `preuves-2026-10-26/guardians-browser.png`. Aucun envoi réel.

Limites explicites : LEG-01 reste partielle jusqu’aux formulaires internes et documents ; LEG-02/03 (autorisations signées, pièces, complétude, DRIEETS, partage production et blocage booking) ne sont pas validées par ce lot. Les contacts historiques après majorité restent conservés ; la durée de conservation et la purge complète sont à traiter dans LEG-05/06. Aucune attestation de conformité juridique.
