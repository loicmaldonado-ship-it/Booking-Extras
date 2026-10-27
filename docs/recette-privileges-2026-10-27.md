# BUG-01 — droits du profil, 27 octobre 2026

Une tentative SQL réelle d’un assistant avec session active a réussi à modifier son propre acces_complet ; la sentinelle « Accès complet auto-attribué » a donc fait échouer le premier test. Le trigger antérieur protégeait rôle/propriétaire/vivier/sections mais omettait le champ ajouté ensuite.

La migration181 étend ce garde à acces_complet et à id. Aucun rôle, grant ni protection de session n’est élargi. La modification directe reste refusée même au titulaire du profil ; la gestion administrative autorisée passe par le serveur avec service_role. Les champs personnels demeurent modifiables.

## Vérifications réellement exécutées

- SQL avec session assistant active :11champs sensibles refusés séparément, INSERT privilégié refusé, métadonnées forgées sans effet, prénom/nom/téléphone autorisés, mise à jour administrative service autorisée. Fixtures annulées.
- API HTTP authentifiée réelle : PATCH acces_complet/role/is_owner/comedien_pool_id/sections_autorisees/gmail_smtp_user/gmail_smtp_app_password/email_espace_perso_template/email_magic_link_template/email/id chacun403 code42501. INSERT403. Nom/téléphone200. Mise à jour user_metadata ne change ni rôle ni propriétaire ni accès complet ; compte créé avec métadonnées forgées également assistant sans privilèges. PATCH administratif service200. Seul compte fictif ensuite nettoyé.
- Migration et tests SQL profil/isolation/auth réussis sur bases locales API28194,27194 et29194 après identification des connexions. Principale27194 jamais réinitialisée.
- Deux resets complets181migrations+seed sur la base jetable28194, exit0 chacun. Après le second : seed/profil/casting atomique/isolation/auth DO et conseiller sécurité sans avertissement.
- Suite Node186/186 réussie. Aucun changement TypeScript/React dans ce lot ; types/lint/build applicatifs réussis sur447c51b restent les dernières preuves correspondantes.

## Portée

BUG-01 vérifie les mutations directes du profil et leurs variantes de métadonnées. Le service_role possède légitimement les droits administratifs ; cette vérification ne remplace pas l’inventaire de toutes les actions privilégiées de BUG-02 ni la matrice complète des données de SEC-03/04. Pas de production, push, déploiement ou message réel. Les copies source antérieures à181 ne doivent pas être diffusées comme version corrigée ; la DB de la copie de recette actuellement lancée a été protégée également.
