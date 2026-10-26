# Casting — tests réels et travail restant

Le test des vraies actions serveur, exécutées avec le client Supabase local et le vrai Storage (revalidation Next neutralisée, notification persistée localement), a reproduit une écriture partielle : une réponse obligatoire absente était refusée après insertion de la photo. Le correctif déplace les réponses obligatoires avant toute écriture, valide le tableau et ignore proprement les précisions de type non textuel.

Le script crée un vrai JPEG via sharp et l’envoie par signature Storage. Après correction : réponses incomplètes refusées sans ligne photo ; chemin d’une autre entrée et fichier absent refusés sans mutation ; première soumission réussie ; deuxième soumission et nouveau slot refusés, une seule référence photo. Les données fictives sont nettoyées dans finally.

Vérifications générales réellement exécutées : 184/184 tests Node, types, lint et build réussis. Les logs de l’échec initial et des résultats finaux sont conservés.

**Échec encore réel :** avec l’option `--stale-slot`, une signature obtenue avant finalisation permet encore un dépôt physique après finalisation. Le test échoue volontairement sur cette exigence (casting-stale-slot.log). BUG-14 n’est pas validée. BUG-15 doit encore couvrir tous les cas vidéo et la concurrence. BUG-13 reste partielle : plusieurs écritures de finalisation sont encore indépendantes, le CAS final ne protège pas tous leurs effets. Il faut une transaction et un contrôle Storage des anciens dépôts. Ne pas confondre la correction ciblée avec la fin du chantier.

Script : scripts/check-casting-finalization-local.mjs (sans option : contrôles réussis ; --stale-slot : reproduction du refus manquant). Aucun transport externe ou production utilisé.
