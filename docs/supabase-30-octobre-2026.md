# Changement Supabase du 30 octobre 2026

Source : email Supabase du 20 octobre, « Final notice: new tables in public need grants from October 30 », retrouvé en lecture seule, et [annonce officielle](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

Les tables déjà présentes conservent leurs droits. Toute nouvelle table publique, y compris lors d'une recréation de base, doit recevoir ses droits API explicitement. RLS et GRANT sont deux protections distinctes : RLS limite les lignes, GRANT autorise l'opération sur la table.

La migration `20261026101717_droits_api_explicites_octobre_30.sql` réconcilie explicitement les 69 tables connues. Elle accorde CRUD au rôle serveur ; pour 30 tables, elle accorde au rôle authenticated uniquement les opérations disposant déjà d'une policy RLS. Les 39 autres restent serveur seulement. Aucun droit de table n'est accordé à anon. Les pages publiques passent par les actions serveur et leurs contrôles de token. Cette migration ne rétablit pas TRUNCATE, REFERENCES ou TRIGGER pour les rôles API.

Les migrations historiques sont conservées. Les nouvelles migrations qui créent une table doivent contenir ensemble CREATE TABLE, activation RLS, policies nécessaires et GRANT par rôle. Les fonctions RPC nouvelles doivent aussi avoir des droits EXECUTE explicites ; l'activation sur invitation est réservée à service_role.

Validation locale : application des droits sur la base isolée, tests SQL d'isolation et d'activation, contrôles navigateur et test de simulation sans privilèges hérités. Les logs complets sont conservés dans le dossier de preuves du 26 octobre. Aucun réglage ni schéma distant n'a été modifié. La vérification des paramètres Data API du projet hébergé et l'application de ces migrations en production restent à effectuer dans une intervention autorisée séparément.
