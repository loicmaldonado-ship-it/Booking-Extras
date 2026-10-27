# Hotfix sécurité local du 27 octobre 2026

État : hotfix local préparé pour revue ; aucun déploiement autorisé ni effectué. Les limites de qualification sont explicitées ci-dessous.

## Périmètre et origine

- Branche exclusive : `hotfix/securite-urgente-2026-10-27`.
- Worktree : `/Users/eleagravagna/Documents/ChatGPT/Booking/hotfix-securite-urgente-2026-10-27`.
- Base : `855b0217fe73ea4dba33eda71f468cd30c2e6b95`, confirmée par `git ls-remote origin refs/heads/main`. Le rattachement du déploiement actuellement servi à ce commit n'a pas pu être vérifié : le compte Vercel connecté ne liste aucun projet Booking Extras. Inspection en lecture seule, aucun réglage changé.
- Source : branche `tests/integration-main-elea-2026-10-22`, commit `489b6bbc6f363d8ca968fe5bfecce3ada6acac34`. Les quatre fichiers non committés de cette branche sont préservés octet pour octet ; ils n'ont pas été importés comme corrections validées.
- Portage sélectif de fichiers et de fonctions existantes, sans fusion globale, sans conflit Git et sans ajouter les fonctionnalités de recette. Voir `provenance.json` : les correspondances exactes sont distinguées des adaptations d'import, des tests nouveaux et du câblage des confirmations.
- Sources principales : `dcfab6d` (gardes, SW, suppression/fusion atomiques), `9b186a9` (cookie), `d44c72c` et `5644d59` (partage, confidentialité, CRON), `5445075` (décodage images), `3a437d1` (champs privilégiés), `1b2c7f7`/`4bf0383` (viviers et références), `489b6bb` (agents), versions et lockfile de la recette finale.

## Corrections reprises

| Sujet | Protection | Validation et limite |
| --- | --- | --- |
| BUG-01 | Trigger protège identité, rôle, propriétaire, accès complet, pool, permissions, SMTP et modèles ; édition personnelle et administrative conservée. | Test SQL réel : 11 champs refusés, INSERT privilégié refusé, métadonnées ignorées, édition personnelle et service conservées. Le test est rendu autonome en créant d'abord le profil de contexte, pour ne pas confondre le bootstrap du premier profil avec une élévation par métadonnées. |
| BUG-02 | Actions figurants authentifiées et visibilité RLS avant mutation privilégiée ; photos/liens rattachés au bon profil ; helpers d'email retirés des Server Actions publiques ; activation/révocation anonymes refusées ; agents authentifiés. | Tests exécutant les modules réels avec dépendances simulées, plus refus SQL réels. Ce lot ne constitue pas l'audit exhaustif de toutes les actions du dépôt. |
| BUG-03 | Fiches, édition, aperçus, documents et doublons sous visibilité de session ; pool étranger et pool nul masqués ; propre pool sans compte conservé ; références directes privées refusées par triggers. | Tests SQL réels de deux équipes et non-membre. Le même helper de visibilité validé dans tests est repris dans les créations/ajouts booking, casting, présentiel, essayage et activation/révocation. Adaptation limitée des appels sur main ; les autres pickers et toutes les mutations indirectes restent à qualifier. |
| BUG-05 | SW ne conserve que la page hors ligne statique ; purge anciens caches Booking Extras. | Tests SW avec cache/navigation simulés. Scénario navigateur réel avec ancien SW, déconnexion et changement de compte hors ligne encore requis. |
| BUG-08 | Trois getters de partage vérifient l'accès projet avant client privilégié ; erreurs SQL explicites ; lecture publique du lien réal échoue fermée. | Refus de non-membre sans lecture admin, tests d'erreurs, SQL réel des tokens de deux projets et anon. Toutes les familles de liens/actions ne sont pas éprouvées par HTTP. |
| Sessions candidates | Cookie Secure en production, HttpOnly et SameSite ; accès révoqué et expiration revérifiés ; erreur d'insertion empêchant le cookie ; logout supprime le jeton serveur avant cookie. | Tests d'exécution : absent/expiré/révoqué/erreur SQL, connexion valide, cookie, logout et erreur de révocation. Course révocation/création non couverte par ce lot. |
| CRON | Secret absent ou incorrect => refus avant DB/email/vidéo. | Tests exécutant les deux routes avec effets surveillés. |
| RLS/Storage | Retrait des mutations directes figurants/photos/liens et policies Storage globales ; lectures de métadonnées sous visibilité de profil/projet ; accès présentiel scindé. | Rejeu SQL depuis main et tests ciblés ; test de tous les parcours upload/signature à compléter en staging. |
| Suppression/fusion | Suppression réservée propriétaire, confirmation explicite, dépendances vérifiées en transaction ; fusion atomique propriétaire. | Version compatible main reprise. Les améliorations récentes dépendant de RGPD/mineurs sont volontairement exclues ; objets orphelins et scénarios concurrents étendus restent à revoir. |
| Dépendances | Versions et lockfile corrigés repris intégralement de tests, sans résolution nouvelle improvisée. | Audit main : 14 alertes dont 2 critiques. Résultat final : 0 alerte connue, audit exécuté de nouveau ; cela ne prouve pas une absence de vulnérabilités inconnues. |

## Sauvegarde, restauration et données

Aucune connexion à Supabase production. Aucun push ni déploiement. Les branches `main`, `elea` et tests n'ont reçu aucun commit.

La base du chemin demandé est le conteneur local `supabase-Booking-Extras-supabase-test.ZAB6ZZ-database-b6a7a4e1c4c4`, PostgreSQL 17.11, port local `54647`. Elle contient 164 migrations enregistrées et 2 profils de test. Elle contient déjà des modifications de recette : elle ne représente pas un main vierge.

- Sauvegarde Git `source.bundle`, vérifiée et restaurée dans `restore-check` ; le HEAD source restauré correspond. Diff initial non committé sauvegardé séparément : les patches des quatre fichiers initiaux restent identiques. Une évolution simultanée supplémentaire de AGENTS.md/next.config.ts et deux nouveaux fichiers de tests agents a été observée dans le worktree source ; elle n'a pas été importée ni écrasée. Le HEAD source reste 489b6bb.
- Sauvegarde locale PostgreSQL `zab6zz-before.dump`, restaurée avec succès dans `booking_hotfix_verified_20261027` avec le rôle local `supabase_admin`. Le premier essai avec `postgres` a échoué sur un paramètre système de fonction Realtime ; sa base partielle est distincte et n'est pas utilisée comme preuve de restauration réussie.
- Original avant/après : `2|d343fff7f09ee0411271a6d37a1aca2a` ; restauration avant essais : même empreinte.
- Le premier essai de migrations sur la copie de recette a rencontré une policy déjà présente. Il n'a pas servi de validation finale.
- Nouvelle base jetable `booking_hotfix_main_20261027` : schéma public reconstruit avec les **154 migrations exactes de main**, puis portage appliqué. Rejeu manuel SQL, sans prétendre avoir qualifié la commande Supabase de déploiement ou sa table d'historique.
- Premier essai : cohorte de **300 profils synthétiques**, empreinte identique avant/après `300|0bd2fd85df51b32592224fd9092dfffb`. Rejeu final complet dans `booking_hotfix_final_20261027` : 300 comptes Auth synthétiques supplémentaires, 300 profils staff et 300 profils candidats ; empreintes `auth.users` (302 lignes, les deux Auth locaux préexistants inclus), `profiles` et `figurants` strictement identiques avant/après. Voir `replay-final-before.log` et `replay-final-after.log`. Ce ne sont pas les 300 utilisateurs réels de production.
- Tests de droits avec fixtures synthétiques et rollback. Aucun effacement de données existantes dans les migrations reprises ; suppressions de policies/triggers et révocations de droits modifient les autorisations, pas les utilisateurs.
- Ces preuves locales ne remplacent pas une sauvegarde de production et son test de restauration en environnement sécurisé lors d'une future livraison autorisée.

Les sauvegardes et essais intermédiaires restent hors Git dans `../hotfix-evidence-2026-10-27/`. Ne pas publier ce répertoire : une sauvegarde contient les données et secrets locaux de test. Seuls les journaux sélectionnés sans secrets sont copiés dans ce dossier de bilan.

## Blocages et risques restants

1. **SMTP corrigé après autorisation explicite.** La fuite du champ `gmail_smtp_app_password` d'un autre profil a d'abord été reproduite avec une sentinelle synthétique. La nouvelle migration `20261027113539_proteger_lecture_secret_smtp_profiles.sql`, générée par le CLI local 2.122.0, remplace le SELECT global de `profiles` par une liste explicite de colonnes sans secret. Aucun secret déplacé ni modifié. Tests SQL : lecture du secret refusée pour soi/autrui/anon, informations d'équipe et champs de connexion conservés, édition personnelle et accès SMTP service préservés. Les requêtes actuelles de profils et leurs relations ont été revues : aucune lecture cliente `profiles(*)` trouvée. Les futurs SELECT * devront également être évités.
   La même migration reprend sans changement les déclarations de droits des six tables candidat/identifiants dans `5644d59` : cela enlève notamment les privilèges TRUNCATE historiques qui ne sont pas filtrés par RLS. Les tests confirment l'absence de TRUNCATE pour authenticated sur profiles et figurants. Aucun TRUNCATE n'a été exécuté.
2. BUG-02/03 restent partiels au sens de l'audit complet : les exports privilégiés, routes, recherches, exports et associations indirectes ne sont pas tous couverts. La visibilité avant activation a été ajoutée avec le helper déjà validé ; l'ensemble des associations métier et écritures bulk reste à auditer.
3. Tests navigateur et HTTP complets manquants : ancien SW hors ligne/changement de compte, toutes familles de partage et leur révocation, restauration des sessions dans un navigateur, parcours email/uploads avec services locaux isolés.
4. Les migrations reprises des 11–12 octobre sont antérieures aux dernières migrations déployées : préparer une stratégie de livraison en staging qui respecte l'historique réel (backfill explicitement revu ou migration de portage consolidée). Ne pas lancer automatiquement `db push` sur la production.
5. La révocation concurrente atomique de la recette et les dernières protections de fusion/suppression dépendent de colonnes/fonctions RGPD ou mineurs absentes de main. Elles ne sont pas importées pour éviter une migration fonctionnelle disproportionnée. Le contrôle `acces_compte` reste appliqué à chaque lecture de session ; un jeton créé dans une course après révocation ne donne pas accès tant que le compte reste désactivé. La réactivation ultérieure et les courses doivent être qualifiées séparément : ce lot n'apporte pas la garantie atomique de la recette complète.
6. Les révocations Storage peuvent révéler des chemins clients directs non recensés. Éprouver les uploads/signatures légitimes avant mise en ligne.

Une restriction par colonne exige de vérifier les requêtes `SELECT *` et de conserver les accès administratifs ; voir [documentation Supabase sur les privilèges de colonnes](https://supabase.com/docs/guides/database/postgres/column-level-security). Cette méthode est utilisée dans la migration SMTP ajoutée avec l'accord de l'utilisateur.

## Prochaine étape contrôlée

Revue des commits et des preuves, puis recette complète sur une copie isolée du schéma/données anonymisées représentatifs. Vérifier la provenance du déploiement réellement servi, l'historique de migrations et les parcours légitimes. Ensuite seulement, sur autorisation séparée : sauvegarde de production, restauration éprouvée, migrations contrôlées, livraison applicative, contrôles de santé et plan de retour arrière qui conserve les données. Aucun de ces actes de production n'a été exécuté ici.

## Commits et vérifications

- `ff94ba6` : reprise des protections validées, dépendances corrigées et tests ciblés.
- `423751b` : restriction SMTP autorisée, réconciliation de droits et test SQL de deux équipes.
- Commit documentaire séparé : bilan, provenance, liste des fichiers et journaux sans secrets.

`files.txt` liste les 60 fichiers fonctionnels/tests modifiés par les deux commits. Les preuves comprennent 49 tests Node ciblés (41 tests repris de la source et 8 tests nouveaux), les deux scripts SQL exécutés avec succès après rejeu complet, l'audit des dépendances à zéro alerte et les empreintes de préservation. La suite fonctionnelle complète de la branche tests, qui dépend des fonctionnalités exclues, n'est pas présentée comme exécutée sur ce hotfix.

Le typecheck séparé `npm run typecheck` est terminé avec code 0. Les résultats finaux lint/build et leurs codes sont consignés dans `verification.json` et les journaux associés. Le build utilise les dépendances installées par `npm ci` depuis le lockfile repris et des variables Supabase inertes pointant sur `127.0.0.1:9`, sans configuration de production.

Lint final : code 0, aucune erreur, quatre avertissements préexistants. Le premier build Turbopack n'a pas été mené à terme dans cet environnement ; la compilation finale utilise le mode webpack explicite. Les avertissements de convention middleware et de cache webpack restent documentés, sans migration de framework ajoutée au hotfix.

Vérification finale terminée : **49/49 tests Node**, **lint code 0** (0 erreur, 4 avertissements), **typecheck code 0**, **build webpack réussi** avec génération des 38 pages statiques et catalogue complet des routes. Audit npm final : **0 alerte connue**. Rejeu SQL complet et scripts de privilèges/SMTP/partage/viviers/sessions : réussis ; empreintes comptes et profils inchangées. Les résultats détaillés, la commande de build utilisée et son identifiant sont dans `verification.json`.
