# Rapprochement des agents - 27 octobre 2026

Defaut reproduit sur base locale28194 : un underscore literal dans nom/email etait traite comme un joker SQL et ecrasait un autre agent. Les filtres de recherche et de rapprochement echappent maintenant underscore, pourcentage et antislash ; recherche insensible a la casse conservee.

Script reel scripts/check-agents-local.mjs : Auth assistant local, profil lu par RLS, requetes et mutations reelles. Le contexte de profil est injecte et la revalidation Next neutralisee. Anonyme sans recherche/ecriture, assistant refuse pour liste et CRUD proprietaire avant client admin. Contacts voisins preserves, creation du literal et upsert repete idempotent, recherches underscore/pourcentage/antislash litterales. Nettoyage des seuls agents fictifs prefixes aleatoirement ; aucun message reel.

191/191 tests Node, types, ESLint et build reussis. Pas de migration. BUG-02/13 restent partiels : erreurs de plusieurs autres mutations et audit exhaustif non termines ; aucune nouvelle coche Trello. Archive17c91e7 et PDF de reunion restent leurs snapshots figures avant ce correctif ; ne pas leur attribuer cette preuve nouvelle.
