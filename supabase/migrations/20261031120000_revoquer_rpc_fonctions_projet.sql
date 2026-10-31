-- Audit sécurité du 31/10/2026 : enregistrer_fonction_projet (SECURITY DEFINER) était exécutable par anon et par
-- authenticated via /rest/v1/rpc : n'importe qui (clé publique) pouvait ajouter des « fonctions » au projet d'une autre
-- équipe et tester l'existence d'un nom. Elle n'est appelée que par les déclencheurs trg_*_fonction (SECURITY DEFINER,
-- exécutés avec les droits du propriétaire) : aucun appel direct n'est nécessaire.
revoke execute on function public.enregistrer_fonction_projet(uuid, text) from public, anon, authenticated;
grant execute on function public.enregistrer_fonction_projet(uuid, text) to service_role;

