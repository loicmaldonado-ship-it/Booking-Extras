# BUG-06 — protection de suppression vérifiée

La suppression définitive reste réservée au propriétaire, avec confirmation SUPPRIMER côté serveur, avertissement et annulation côté navigateur. Le RPC verrouille le profil et refuse toutes les références FK métier. Les profils avec historique sont orientés vers le parcours RGPD.

Un test réel a révélé qu’un fichier privé pouvait rester en Storage sans ligne photo correspondante, par exemple après une panne de référencement. La nouvelle migration refuse aussi ce cas avant suppression. Elle conserve le parcours de fusion, qui utilise un RPC distinct. Le search_path de la fonction de suppression est désormais vide.

La fermeture par Échap conservait la confirmation saisie : elle est maintenant effacée comme lors d’Annuler, et toute réouverture exige une nouvelle saisie. Aucun clic de suppression définitive n’a été effectué sur la fiche Sacha pendant le contrôle navigateur.

## Vérifications réellement exécutées

- SQL : profil vide supprimé ; candidature, booking, essayage et média sans référence empêchent la suppression ; autres données conservées ; assistante et anon refusés. DO réussi, toutes fixtures annulées.
- API et Storage réels : assistante refusée ; propriétaire supprime le profil fictif vide ; profil avec fichier physique sans ligne photo refusé et média toujours accessible par lien signé. Après retrait du fichier par l’API Storage, suppression du profil devenu vide autorisée. Fixtures et sessions locales du script nettoyées.
- Navigateur : avertissement clair et bouton final désactivé tant que SUPPRIMER n’est pas saisi ; saisie, Échap, réouverture : champ vide et bouton désactivé ; Annuler ferme la fenêtre et préserve Sacha. Capture jointe.
- Cinq tests comportementaux nouveaux : ouvrir/annuler ne supprime rien ; Échap réinitialise ; confirmation incorrecte refusée avant accès privilégié ; non-propriétaire refusé ; erreur DB renvoyée sans redirection de succès.
- Suite complète **184/184**, types réussis, ESLint sans diagnostic, build réussi. Logs joints.

BUG-06 peut être marquée terminée et vérifiée pour la protection de suppression décrite. Cela ne clôt pas l’audit de toutes les actions privilégiées ni la politique de rétention RGPD. Tous les essais ont utilisé les bases locales et données fictives ; aucune production, aucun push. Le schéma compte 178 migrations et son dernier replay complet reste à faire avant livraison de la copie de recette.
