-- Read one consistent snapshot; only the trusted server role can execute this.
create or replace function public.rgpd_lister_profils_inactifs_snapshot(p_seuil date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with booking_activity as (
    select figurant_id, max(date) as last_date
    from public.bookings group by figurant_id
  ), application_activity as (
    select figurant_id, max((created_at at time zone 'UTC')::date) as last_date
    from public.candidatures group by figurant_id
  ), activity as (
    select f.id, f.prenom, f.nom, f.email, f.anonymisation_en_cours_at,
      greatest((f.updated_at at time zone 'UTC')::date, b.last_date, c.last_date) as derniere_activite
    from public.figurants f
    left join booking_activity b on b.figurant_id = f.id
    left join application_activity c on c.figurant_id = f.id
    where f.anonymise = false
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'prenom', prenom, 'nom', nom, 'email', email,
    'derniereActivite', derniere_activite,
    'effacementEnCours', anonymisation_en_cours_at is not null
  ) order by derniere_activite nulls first, id), '[]'::jsonb)
  from activity
  where anonymisation_en_cours_at is not null
     or (derniere_activite is not null and derniere_activite < p_seuil);
$function$;
revoke all on function public.rgpd_lister_profils_inactifs_snapshot(date) from public, anon, authenticated;
grant execute on function public.rgpd_lister_profils_inactifs_snapshot(date) to service_role;
notify pgrst, 'reload schema';
