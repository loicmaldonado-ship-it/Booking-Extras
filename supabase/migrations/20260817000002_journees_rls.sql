alter table public.journees enable row level security;

create policy "authenticated full access" on public.journees
  for all using (true) with check (true);

grant all on public.journees to service_role, authenticated;
