# Checklist de mise en production (REL-04, préparée le 30/10/2026)

À exécuter par une personne autorisée (Loïc / Éléa), sur décision de Loïc et Mathieu. Rien de ce qui suit n'a été exécuté
pendant la reprise : aucun déploiement, aucune fusion, aucune action sur la production.

## A. Avant (J-2)
1. [ ] Recette métier faite et signée (REL-03) sur une préproduction isolée (REL-01).
2. [ ] Réconcilier les branches : `main` et `hotfix/securite-urgente-2026-10-27` contiennent des commits absents de la branche
       de tests (le hotfix a été **reporté** dans la branche de tests par la migration `20261030140000`, mais la branche hotfix
       elle-même n'est pas fusionnée). Décider de l'ordre de fusion et le faire par pull request avec CI verte (jobs `checks`
       et `integration`).
3. [ ] Sauvegarde complète de la base de production (Supabase → Database → Backups, ou `pg_dump`) **et** liste des objets Storage.
4. [ ] Tester les migrations sur une COPIE de la production (REL-02) : `supabase db push --dry-run` puis application sur la copie.
       Points d'attention :
       - `20261026101717_droits_api_explicites_octobre_30` et `20261030140000_report_hotfix_secret_smtp_profiles` (droits) ;
       - `20261030141000_isoler_lecture_projet_membres`, `20261030143000_isoler_lecture_profiles_equipe` (visibilité entre équipes) ;
       - `20261030160000_bareme_par_equipe` (supprime une contrainte d'unicité et la recrée par équipe ; vérifier qu'aucun doublon
         convention/cachet/date n'existe en prod avant) ;
       - `20261030170000_storage_public_sans_listing` (retire le listing public : vérifier qu'aucun outil externe ne liste ces espaces).
5. [ ] Variables Vercel (voir `docs/secrets.md`) : `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY` (inchangée, sinon procédure de rotation),
       `VAPID_*`, Gmail support (COM-05), `NEXT_PUBLIC_SITE_URL` = domaine réel, **`BOOKING_TEST_MODE` absent ou ≠ 1**.
6. [ ] Limites : la plateforme Vercel limite les requêtes à ~4,5 Mo ; vérifier sur mobile que la compression d'images garde
       chaque envoi de formulaire sous ce seuil (MED-01), sinon prévoir l'envoi direct vers le stockage.
7. [ ] Prévenir les utilisatrices : créneau, durée, et le fait qu'elles devront se reconnecter.

## B. Pendant
1. [ ] Mettre le site en maintenance ou choisir un créneau sans activité.
2. [ ] Appliquer les migrations sur la production (`supabase db push`), dans l'ordre, et lire la sortie.
3. [ ] Déployer la version validée (Vercel → Promote) ; noter l'identifiant du déploiement précédent pour le retour arrière.
4. [ ] `notify pgrst, 'reload schema'` si l'API ne voit pas un changement de droits.

## C. Smoke test production (REL-05) — 15 min
- [ ] Accueil public, `/login`, connexion cheffe, tableau de bord, projets, candidatures, bookings, casting, essayages, équipe, barème.
- [ ] Connexion candidate, `/compte`, candidature sur une annonce de test, message reçu.
- [ ] Un lien de partage (documents) ouvert en navigation privée.
- [ ] Un email réel de test (invitation ou convocation) vers une adresse interne.
- [ ] Journal Vercel : filtrer sur `[booking-error]` (une ligne JSON par erreur serveur ou navigateur : env, release = commit,
      route sans token, type, message et pile nettoyés). Aucune nouvelle erreur après le smoke test (QA-08). Vérifier que
      « Automatically expose System Environment Variables » est actif pour que `release` porte le commit (`VERCEL_GIT_COMMIT_SHA`).

## D. Retour arrière
- Code : re-promouvoir le déploiement précédent dans Vercel.
- Base : les migrations du 30/10 sont additives sauf la contrainte d'unicité du barème et les policies ; en cas de problème,
  restaurer la sauvegarde de l'étape A.3 plutôt que d'écrire des migrations inverses à chaud.
