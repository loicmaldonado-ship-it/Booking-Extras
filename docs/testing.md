# Tests — exécution locale réelle et tests manquants

## Exécutés le 11/10/2026

`npm test` sous Node 22.16 avec `--experimental-strip-types` : **24 tests unitaires et statiques réussis** couvrant notamment la stratégie de cache Service Worker, les redirections, les chemins de médias casting, les signatures binaires JPEG/PNG/WebP/PDF et des assertions statiques sur les gardes et migrations. Les tests statiques ne valident pas les permissions SQL réellement.

Compilation syntaxique TypeScript par `transpileModule` : **15 fichiers source modifiés analysés**, aucune erreur de syntaxe détectée. Cela **ne constitue pas** un typecheck.

## Impossible ici

- `npm ci` : environnement sans accès au package `zod-validation-error@4.0.2` ; installation hors ligne échouée (`ENOTCACHED`).
- `npm run lint`, `npm run typecheck`, `npm run build` : dépendances incomplètes ; vérification impossible, non revendiquée comme réussie.
- `supabase start`, `supabase db reset`, tests RLS/SQL : Docker indisponible.
- Recette navigateur, responsive, vraie compression/lecture vidéo et uploads sur Storage : pas exécutées.

## Matrice de recette minimale requise avant intégration

- Cheffe A, cheffe B, assistante A, candidate A, candidate désactivée ; contrôler listes, fiches, API, fichiers, documents et Server Actions.
- Login avec `next=//malicious.tld`, encodages et URLs normales ; aucun départ vers l’extérieur.
- Session candidate existante révoquée ; lien magique déjà utilisé ; double clic sur lien ; déconnexion/connexion.
- Offline : consulter une fiche privée, se déconnecter et couper le réseau ; jamais la retrouver depuis Cache Storage.
- Casting : slot signé valide, slot d’un autre candidat, faux chemin, Storage inexistant, soumission concurrente, renvoi après finalisation.
- `npm audit` sur le lockfile et correction contrôlée des alertes.
