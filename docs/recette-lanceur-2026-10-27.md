# Lanceur local — 27 octobre 2026

Le démarrage conserve Auth, REST, Storage, passerelle et boîte email locale ; il exclut Studio, Realtime, métadonnées, Edge Runtime, journalisation, pooler et transformation image non utilisés par les parcours de cette copie. Le contrôle de santé reste obligatoire. Ce profil minimal a démarré une base neuve à 180 migrations. La copie finale avec ce lanceur reste à vérifier avant diffusion.

Les erreurs JSON du CLI sont désormais prises en compte dans le diagnostic, avec suppression des lignes contenant clés, mots de passe ou URL PostgreSQL. Le test injecte un échec réel du processus substitué : diagnostic utile présent et secrets factices absents. Les autres protections contre configuration personnelle, URL distante, schéma modifié et arrêt hors namespace restent vérifiées.

8/8 tests ciblés et 186/186 suite complète réussis. Le build applicatif reste celui du lot 447c51b : seuls lanceur, tests et documents changent ici. Les tests Windows et installation chez les destinataires ne sont pas démontrés.
