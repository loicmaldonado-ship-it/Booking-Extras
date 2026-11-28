# BUG-07 — casting présentiel : isolation vérifiée

La correction existante des policies était développée mais n’avait pas encore sa matrice CRUD exécutée sur deux cheffes. Ce lot ajoute ces vérifications sans modifier l’application ni le schéma.

## SQL réel

Deux cheffes fictives non propriétaires globales, chacune propriétaire d’un projet et avec session staff active. Pour chaque sens A vers B et B vers A : SELECT sur les créneaux et entrées étrangers renvoie zéro ligne ; INSERT étranger refusé ; UPDATE et DELETE étrangers affectent zéro ligne. Le transfert d’une ligne locale vers une journée/projet étranger est refusé. SELECT/INSERT/UPDATE/DELETE locaux réussissent sur les deux tables. Absence de l’ancienne policy authenticated full access vérifiée. Les données étrangères restent intactes. DO réussi ; toutes fixtures et sessions annulées.

## API authentifiée réelle

Deux comptes Supabase temporaires créés directement par l’API admin locale, sans envoi d’email. Connexion avec leurs propres identifiants générés, non affichés. Même matrice CRUD, dans les deux sens, réellement exécutée via PostgREST. Les lectures étrangères sont vides, inserts refusés 42501, updates/deletes ne retournent aucune ligne ; les opérations locales réussissent. Les lignes étrangères restent présentes après les tentatives. Seuls les comptes/projets/profils créés par ce test ont été supprimés.

Le test d’intégrité de créneaux casting/essayage a aussi été rejoué : affectations correctes acceptées ; jour/créneau/rôle étrangers refusés même sous service_role, sans modification partielle.

Scripts : tests/casting-presentiel-rls-local.sql ; scripts/check-casting-rls-local.mjs ; tests/slots-integrity-local.sql. Preuves : casting-rls-api.log et casting-rls-sql.log.

BUG-07 peut être terminée et vérifiée. Cela ne valide pas automatiquement tout le parcours métier MET-07, ni l’intégralité des Server Actions qui utilisent service_role (BUG-02/SEC-03). Le compte propriétaire global conserve son accès global prévu : les deux sujets de ce test sont des cheffes ordinaires distinctes. Aucun code applicatif modifié : les derniers résultats généraux restent 184 tests Node, types/lint/build réussis sur f4961bb ; ce lot est vérifié par SQL et API et ne revendique pas une nouvelle compilation.
