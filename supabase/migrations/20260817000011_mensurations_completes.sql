-- Champs de mensuration manquants pour matcher la fiche costume type
-- (veste/pantalon en tailles textuelles — "48/50" — le reste en cm).
alter table public.figurants add column if not exists veste text;
alter table public.figurants add column if not exists pantalon text;
alter table public.figurants add column if not exists tour_cou_cm smallint;
alter table public.figurants add column if not exists jambes_ext_cm smallint;
alter table public.figurants add column if not exists jambes_int_cm smallint;
alter table public.figurants add column if not exists gant text;
alter table public.figurants add column if not exists carrure_cm smallint;
