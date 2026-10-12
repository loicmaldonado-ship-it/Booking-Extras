# Reprise locale – lot supplémentaire du 11 octobre 2026

**Source :** archive reçue `Booking-Extras-main(1).zip`, base `main` du 08/10/2026 ; reprise des fichiers locaux déjà modifiés du premier lot.
**Restrictions :** aucune écriture GitHub, aucune écriture Trello, aucun déploiement, aucune base réelle modifiée.

## Résultat vérifiable

- `npm test` : **24 tests passés**, dont tests de contenu d'images/PDF et vérifications statiques des frontières d'autorisation/SQL. Ces tests statiques **ne remplacent pas** les vérifications d'accès en base.
- Analyse syntaxique de tous les fichiers TS/TSX source réalisée avec le parseur TypeScript global, sans erreur de syntaxe (à relancer sur l'état final).
- `npm ci` : **échec** (`EAI_AGAIN` / registre npm non joignable et erreur npm « Exit handler never called »). Donc **pas de lint complet, pas de typecheck, pas de build Next.js**.
- Docker/Postgres/Supabase : indisponibles. **Aucune migration ni test RLS ou transactionnel exécuté en vraie base**.
- UI : changements vérifiés au niveau du code, **non testés sur navigateur/téléphone**.

## Cartes réellement travaillées dans ce lot

| Carte | Changement implémenté dans la copie | Test réellement exécuté | Validation restante |
|---|---|---|---|
| BUG-06 (P0) | Modal de confirmation exigeant « SUPPRIMER » ; action réservée au propriétaire ; RPC atomique `delete_unused_figurant` empêchant les cascades si une FK existe | Tests statiques | DB/migration, validation de la modale et scénario profil vide/avec historique |
| BUG-07 (P0) | Migration `20261011000003_casting_presentiel_rls.sql` supprime les policies `authenticated full access` sur créneaux et entrées ; limite par projet/journée | Tests statiques | Supabase : SELECT, INSERT, UPDATE et DELETE par cheffe A/B/assistante |
| BUG-08 (P0) | `getPartageToken`, `getPartageTitre`, `getJourneePartageLien` exigent tous `checkProjetAccess` côté serveur | Tests statiques | Scénarios authentifiés/hors-projet et owner avec RLS |
| BUG-11 (P1) | Validation serveur de signature binaire JPEG/PNG/WebP, MIME cohérent, taille max et extension canonique ; contrôle PDF ; nettoyage d'objets Storage après erreur DB dans plusieurs actions | 4 tests unitaires binaires + couverture statique | Vrais formats iOS et traitement d'images côté navigateur ; upload Storage + erreurs DB |
| BUG-12 (P1) | `mergeFigurants` passe par RPC SQL transactionnelle avec verrouillage et propagation des FK ; toute collision SQL déclenche rollback, sans suppression silencieuse des candidatures conflictuelles | Test statique du SQL et du branchement | Scénarios DB complets ; conflits ; interactions avec sessions/Storage ; confirmation métier de la règle d'arrêt sur doublon |
| BUG-17 (P1) | Défilement horizontal indiqué pour les vues tableau de candidatures et de base profils | Syntaxe TSX | Vérification mobile de toutes les tables (portée **partielle** de la carte) |
| BUG-02 / BUG-03 (P0) | `createFigurant`, modification, agent, upload, suppression de photo/lien : contrôle staff + pool comédien ; cohérence des identifiants ligne/profil | Test statique | Recette avec deux pools/équipes et audit de toutes les autres Server Actions |
| BUG-13 (P1) | Contrôle explicite d'échecs d'upsert pour la création de liens publics ; nettoyage des uploads quand écriture DB échoue | Tests statiques partiels | Auditer toutes les mutations Supabase du dépôt |

## Fichiers principaux nouveaux ou modifiés

- `src/lib/media/validate-upload.ts`
- `src/lib/figurants/photos.ts`
- `src/lib/figurants/actions.ts`
- `src/components/figurants/delete-figurant-confirm.tsx`
- `src/components/figurants/doublons-panel.tsx`
- `src/app/figurants/[id]/page.tsx`
- `src/app/figurants/page.tsx`
- `src/lib/partage/actions.ts`
- `src/lib/casting/actions.ts`
- `src/lib/auth/avatar-actions.ts`
- `src/lib/annonces/moodboard-actions.ts`
- `src/lib/essayages/actions.ts`
- `src/lib/documents/template-actions.ts`
- `src/lib/references/actions.ts`
- `src/lib/projets/annonce-photo-actions.ts`
- `src/components/candidatures/candidatures-table.tsx`
- `supabase/migrations/20261011000003_casting_presentiel_rls.sql`
- `supabase/migrations/20261011000004_merge_figurants_atomique.sql`
- `supabase/migrations/20261011000005_delete_unused_figurant.sql`
- `tests/validate-upload.test.mjs`
- `tests/access-and-deletion-guards.test.mjs`
- `tests/media-and-staff-boundaries.test.mjs`

## Sécurité/compatibilité : attention avant toute utilisation

1. Les **5 migrations du 11/10** présentes dans le dépôt de travail (deux du lot antérieur et trois de ce lot) sont nécessaires au code. Ne **jamais les appliquer directement sur la production** : vérifier intégralement sur Supabase isolé avant PR et déploiement.
2. Nouvelle règle de fusion : conflit de compte ou de candidature = **erreur et rollback**, pas suppression automatique d'un doublon. Elle préserve les données et demande une décision métier si un traitement automatique des conflits est voulu.
3. La suppression définitivement sûre exige un compte owner et refuse toute fiche reliée à une autre table par clé étrangère, y compris des contacts sans booking, ce qui est volontairement conservateur. Les données personnelles de fiches avec historique relèvent du parcours RGPD.
4. Les changements UX peuvent être améliorés (accessibilité de la modal, véritable expérience mobile), mais **aucune recette réelle n'a eu lieu**.
5. Les tests unitaires actuels sont utiles pour sécuriser des primitives et détecter certaines régressions, **pas pour certifier l'application complète**.

## Reprise des validations une fois l'environnement disponible

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npx supabase start
npx supabase db reset
```

**Attention :** les commandes Supabase ci-dessus ciblent **la base locale uniquement**, sans `--linked` ni `db push`. Recetter ensuite tous les parcours métier et les permissions entre comptes, puis documenter les résultats dans `docs/trello-report.md`.

**Livraison :** ce lot n'est pas la livraison finale des 96 cartes. La matrice Trello demeure une photographie consultative, sans écriture sur le tableau distant.
