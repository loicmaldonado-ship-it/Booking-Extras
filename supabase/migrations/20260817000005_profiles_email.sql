-- Dénormalise l'email sur profiles pour l'afficher dans l'UI (page Équipe)
-- sans appel admin.listUsers() à chaque rendu.
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when (select count(*) from public.profiles) = 0 then 'chef' else 'assistant' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
