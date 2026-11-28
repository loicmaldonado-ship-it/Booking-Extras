# Dépendances — rapport de reprise (QA-03)

Date : 20 octobre 2026. Branche de référence : `elea` (`5d52f05`).

Audit **effectivement exécuté par l'utilisatrice** sur macOS : 589 packages, 7 alertes (5 `high`, 2 `moderate`, aucune `critical`). La liste a été transmise dans le terminal ; elle a été répertoriée, sans prétendre disposer des CVE complètes.

| Dépendance signalée | Niveau | Classification constatée | Suivi |
| --- | --- | --- | --- |
| `@next/eslint-plugin-next` | high | transitive/dev | analyser l'avis et le graphe ; ne pas rétrograder Next |
| `braces` | high | transitive/dev | dépend d'ESLint |
| `eslint-config-next` | high | directe/dev | avis à rapprocher de Next 16.4.0 |
| `fast-glob` | high | transitive/dev | dépend d'ESLint |
| `micromatch` | high | transitive/dev | dépend d'ESLint |
| `exceljs` | moderate | directe/runtime | analyser la fonction vulnérable avant un changement majeur |
| `uuid` | moderate | transitive/runtime via ExcelJS | corriger via dépendance parent lorsque possible |

`npm audit fix --force` a été **volontairement exclu** : npm proposait des versions majeures/rétrogrades incompatibles avec le framework et potentiellement les exports.

Ajout CI : `npm audit --omit=dev --audit-level=high` bloque **uniquement** une nouvelle alerte `high` ou `critical` sur des packages utilisés à l'exécution. Il ne considère **pas** les alertes de développement comme corrigées : le suivi reste ouvert jusqu'à l'analyse détaillée.

À poursuivre avant clôture de QA-03 : relancer `npm audit --json` sur le Mac sans publier de secrets ; lire `via`/`range`/`fixAvailable`, `npm ls`, consulter les avis associés, proposer les mises à jour compatibles, lancer tests/lint/types/build/recette PDF/exports et refaire le relevé.

Aucune modification du lockfile, aucune mise à jour forcée ni opération en production dans ce lot.
