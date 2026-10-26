# Contrôle d’âge au booking — 26 octobre 2026

Branche de tests intégrant main/elea, aucune écriture distante.

Une date de naissance absente permettait auparavant de contourner le contrôle du dossier mineur. Le trigger exige désormais une naissance valide avant booking actif, réactivation ou convocation. L’annulation reste possible même si la naissance manque. Le parcours adulte continue de fonctionner. Le contrôle existant des pièces des mineurs reste appliqué à la date du tournage.

L’ajout rapide d’un nouveau profil exige sa naissance. Un nouveau mineur est orienté vers la création de sa fiche puis le dossier légal, avant toute création de booking. Une fiche existante sans naissance doit être complétée depuis sa fiche ; une valeur fournie à l’ajout rapide ne remplace pas silencieusement l’identité existante. La journée affiche les âges absents et dossiers mineurs incomplets/non vérifiés, y compris après une modification des représentants ou pièces. Les dates sont appréciées au jour du tournage.

## Vérifications

- TypeScript réussi après correction d’un ordre de déclaration ; ESLint sans diagnostic ; build réussi.
- Suite Node 179/179. Trois tests comportementaux nouveaux : nouveau profil sans naissance refusé avant création ; nouveau mineur orienté avant création ; fiche existante sans naissance refusée.
- `tests/booking-age-local.sql` : DO réussi sur les deux bases isolées. Booking sans naissance refusé ; réactivation refusée ; convocation refusée ; annulation possible ; après renseignement d’une naissance adulte, booking et message acceptés. Fixtures annulées.
- `tests/minor-dossiers-local.sql` et `tests/slots-integrity-local.sql` : DO réussi après migration. La fixture adulte des créneaux a désormais une naissance explicite.
- Navigateur propriétaire : ancien booking fictif dont la naissance a été retirée affiché dans l’alerte ; champ de naissance et explication Mineurs visibles dans l’ajout rapide. Aucune soumission nouvelle dans le navigateur. Fixture nettoyée via API ensuite. Capture jointe.
- Migration appliquée directement sur les deux bases locales ; chaîne complète à 174 migrations à rejouer lors de la préparation du paquet final. Le précédent reset complet couvre 173 migrations ; ne pas annoncer un reset complet à 174 à ce stade.

## Limites

Une correction d’identité ou de pièce ne supprime pas automatiquement un ancien booking : l’alerte le signale et le serveur bloque sa prochaine convocation/validation tant que le dossier est incomplet. Les convocations déjà envoyées ne sont pas rappelées. L’envoi email/SMS réel est toujours interdit dans cette recette. Les dates de naissance déclarées ne constituent pas une vérification administrative d’identité. La validation métier et la règle de conservation restent attendues.
