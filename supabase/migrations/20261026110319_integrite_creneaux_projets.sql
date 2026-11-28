-- Intégrité appliquée aussi aux écritures service_role qui contournent RLS.
-- NOT VALID évite de modifier les anciennes données ; toute nouvelle écriture est contrôlée.
do $ddl$ begin
if not exists(select 1 from pg_constraint where conrelid='public.essayage_journees'::regclass and conname='essayage_journee_projet_unique') then
 alter table public.essayage_journees add constraint essayage_journee_projet_unique unique(id,projet_id);
end if;
if not exists(select 1 from pg_constraint where conrelid='public.essayage_creneaux'::regclass and conname='essayage_creneau_journee_unique') then
 alter table public.essayage_creneaux add constraint essayage_creneau_journee_unique unique(id,essayage_journee_id);
end if;
if not exists(select 1 from pg_constraint where conrelid='public.essayages'::regclass and conname='essayage_journee_projet_fk') then
 alter table public.essayages add constraint essayage_journee_projet_fk foreign key(essayage_journee_id,projet_id) references public.essayage_journees(id,projet_id) not valid;
end if;
if not exists(select 1 from pg_constraint where conrelid='public.essayages'::regclass and conname='essayage_creneau_journee_fk') then
 alter table public.essayages add constraint essayage_creneau_journee_fk foreign key(creneau_id,essayage_journee_id) references public.essayage_creneaux(id,essayage_journee_id) not valid;
end if;
if not exists(select 1 from pg_constraint where conrelid='public.essayages'::regclass and conname='essayage_creneau_requires_journee') then
 alter table public.essayages add constraint essayage_creneau_requires_journee check(creneau_id is null or essayage_journee_id is not null) not valid;
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_presentiel_journees'::regclass and conname='cp_journee_projet_unique') then
 alter table public.casting_presentiel_journees add constraint cp_journee_projet_unique unique(id,projet_id);
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_presentiel_creneaux'::regclass and conname='cp_creneau_journee_unique') then
 alter table public.casting_presentiel_creneaux add constraint cp_creneau_journee_unique unique(id,journee_id);
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_roles'::regclass and conname='casting_role_projet_unique') then
 alter table public.casting_roles add constraint casting_role_projet_unique unique(id,projet_id);
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_presentiel_entries'::regclass and conname='cp_entry_journee_projet_fk') then
 alter table public.casting_presentiel_entries add constraint cp_entry_journee_projet_fk foreign key(journee_id,projet_id) references public.casting_presentiel_journees(id,projet_id) not valid;
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_presentiel_entries'::regclass and conname='cp_entry_creneau_journee_fk') then
 alter table public.casting_presentiel_entries add constraint cp_entry_creneau_journee_fk foreign key(creneau_id,journee_id) references public.casting_presentiel_creneaux(id,journee_id) not valid;
end if;
if not exists(select 1 from pg_constraint where conrelid='public.casting_presentiel_entries'::regclass and conname='cp_entry_role_projet_fk') then
 alter table public.casting_presentiel_entries add constraint cp_entry_role_projet_fk foreign key(role_id,projet_id) references public.casting_roles(id,projet_id) not valid;
end if;
end $ddl$;
