-- Mots de passe des comptes candidat·es dans une table à part : de
-- nombreuses pages (dont des partages publics) lisent figurants(*), et
-- l'empreinte du mot de passe ne doit jamais quitter le serveur. Cette
-- table n'est lue que par la connexion, la création de compte et le
-- changement de mot de passe.
create table if not exists public.figurant_comptes (
  figurant_id uuid primary key references public.figurants (id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.figurant_comptes enable row level security;
grant all on public.figurant_comptes to service_role;

insert into public.figurant_comptes (figurant_id, password_hash)
select id, password_hash from public.figurants where password_hash is not null
on conflict (figurant_id) do nothing;

alter table public.figurants drop column if exists password_hash;
